import { DomainError } from "@/lib/errors"
import type { SyncState } from "@/lib/db/schema"
import { catalogsRepo, slugify } from "@/modules/catalogs"

import * as credRepo from "./repository"
import { getAdapter } from "./providers/registry"
import { ProviderError } from "./providers/types"
import type { NormalizedCollection, NormalizedProduct } from "./providers/types"

// Lock simple por catalogId en memoria del proceso (definition sección 7.1): un
// disparo manual mientras hay una corrida en curso es no-op. En serverless el
// lock no cruza instancias; para el trigger manual de Fase 1 (esporádico) es
// suficiente. Un lock robusto (advisory lock de Postgres) queda como mejora.
const running = new Set<string>()

const MAX_PAGE_RETRIES = 4
const BACKOFF_MS = [1000, 5000, 15000, 30000]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type SyncResult = {
  status: "completed" | "aborted" | "skipped"
  counts: { fetched: number; upserted: number; archived: number }
  errors: string[]
}

// Sincroniza un catálogo integrado: fetchProducts paginado → upsert de
// colecciones + productos por (catalogId, externalId) → archivado de los
// huérfanos (solo si la paginación terminó completa). Reanuda desde el cursor
// persistido en syncState (definition sección 7.1).
export async function syncCatalog(catalogId: string): Promise<SyncResult> {
  if (running.has(catalogId)) {
    return { status: "skipped", counts: { fetched: 0, upserted: 0, archived: 0 }, errors: [] }
  }
  running.add(catalogId)
  try {
    return await runSync(catalogId)
  } finally {
    running.delete(catalogId)
  }
}

async function runSync(catalogId: string): Promise<SyncResult> {
  const catalog = await catalogsRepo.getCatalog(catalogId)
  if (!catalog) throw new DomainError("not_found", `catálogo '${catalogId}' no encontrado`)
  if (catalog.source === "manual")
    throw new DomainError("invalid_payload", "un catálogo manual no se sincroniza")
  if (!catalog.credentialId)
    throw new DomainError("invalid_payload", "el catálogo no tiene credencial asociada")

  const cred = await credRepo.get(catalog.credentialId)
  if (!cred) throw new DomainError("not_found", "credencial no encontrada")
  if (!cred.active)
    throw new DomainError("invalid_payload", "la integración está desactivada")

  const adapter = getAdapter(cred.provider)

  // Reanudar desde el cursor persistido (corte previo) o empezar de cero.
  let cursor: string | null = catalog.syncState?.cursor ?? null
  const counts = { fetched: 0, upserted: 0, archived: 0 }
  const errors: string[] = []
  const seenExternalIds: string[] = []
  // Cache de slugs de colección resueltos en esta corrida (externalId → slug).
  const collectionSlugs = new Map<string, string>()
  let position = 0
  let completed = false
  // La moneda de un catálogo integrado es autoritativa del proveedor (Shopify:
  // Shop.currencyCode; el precio de cada variante es Money en esa moneda). La
  // sincronizamos una vez por corrida al catálogo, no por producto.
  let currencySynced = false

  paging: while (true) {
    let page: Awaited<ReturnType<typeof adapter.fetchProducts>> | null = null
    // Reintentos con backoff ante errores reintentables (timeout, 429, 5xx).
    for (let attempt = 0; attempt <= MAX_PAGE_RETRIES; attempt++) {
      try {
        page = await adapter.fetchProducts(cred, cursor ?? undefined)
        break
      } catch (err) {
        const retryable = err instanceof ProviderError ? err.retryable : true
        const msg = err instanceof Error ? err.message : String(err)
        if (!retryable || attempt === MAX_PAGE_RETRIES) {
          // Aborta dejando el cursor persistido; la próxima corrida reanuda.
          errors.push(`página (cursor=${cursor ?? "inicio"}): ${msg}`)
          await persistState(catalogId, cursor, counts, errors)
          break paging
        }
        await sleep(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)])
      }
    }
    if (!page) break

    // Persistir la moneda de la tienda al catálogo (una vez por corrida). Es
    // autoritativa: sobrescribe cualquier valor previo porque los precios
    // sincronizados están denominados en ella.
    if (!currencySynced && page.currency && page.currency !== catalog.currency) {
      await catalogsRepo.updateCatalog(catalogId, { currency: page.currency })
      currencySynced = true
    }

    for (const item of page.items) {
      counts.fetched++
      try {
        await upsertProduct(catalogId, item, position++, collectionSlugs)
        counts.upserted++
        seenExternalIds.push(item.externalId)
      } catch (err) {
        // Producto suelto inválido: se omite, se cuenta, el sync sigue (sección 7.1).
        errors.push(
          `producto ${item.externalId}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    cursor = page.nextCursor ?? null
    // Persistir el cursor en cada página: un corte reanuda, no reempieza.
    await persistState(catalogId, cursor, counts, errors)
    if (!cursor) {
      completed = true
      break
    }
  }

  // Archivado: solo si la paginación terminó completa (evita archivar productos
  // que existen pero no se alcanzó a paginar, sección 7.1).
  if (completed) {
    counts.archived = await catalogsRepo.archiveProductsNotIn(catalogId, seenExternalIds)
    await persistState(catalogId, null, counts, errors)
    await credRepo.update(cred.id, { lastSyncedAt: new Date() })
  }

  return {
    status: completed ? "completed" : "aborted",
    counts,
    errors,
  }
}

async function persistState(
  catalogId: string,
  cursor: string | null,
  counts: SyncState["counts"],
  errors: string[],
): Promise<void> {
  const state: SyncState = {
    lastRunAt: new Date().toISOString(),
    cursor,
    counts,
    errors,
  }
  await catalogsRepo.updateCatalog(catalogId, { syncState: state })
}

async function upsertProduct(
  catalogId: string,
  item: NormalizedProduct,
  position: number,
  collectionSlugs: Map<string, string>,
): Promise<void> {
  const collectionIds: string[] = []
  for (const nc of item.collections) {
    collectionIds.push(await resolveCollection(catalogId, nc, collectionSlugs))
  }
  await catalogsRepo.upsertProductByExternal({
    catalogId,
    externalId: item.externalId,
    title: item.title,
    currency: item.currency,
    images: item.images,
    imageUrl: item.imageUrl,
    status: item.status,
    position,
    refundable: item.refundable,
    options: item.options,
    variants: item.variants,
    collectionIds,
    raw: item.raw,
  })
}

// Upserta la colección (definition sección 7.2) y devuelve su slug. Reusa el slug
// existente si ya está mapeada por (catalogId, externalId); si es nueva, deriva
// un slug del handle garantizando unicidad global (collections.id es PK global,
// y dos catálogos podrían compartir handle).
async function resolveCollection(
  catalogId: string,
  nc: NormalizedCollection,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(nc.externalId)
  if (cached) return cached

  const existing = await catalogsRepo.findCollectionByExternal(catalogId, nc.externalId)
  let id: string
  if (existing) {
    id = existing.id
  } else {
    const base = slugify(nc.handle)
    id = base
    for (let i = 2; await catalogsRepo.getCollection(id); i++) {
      id = `${base}-${i}`.slice(0, 64)
    }
  }
  await catalogsRepo.upsertCollectionByExternal({
    id,
    catalogId,
    title: nc.title,
    externalId: nc.externalId,
    position: cache.size,
  })
  cache.set(nc.externalId, id)
  return id
}
