// Efectos de stock del lifecycle de la compra (definition sección 9.3 / 9.3.1).
// El compromiso de stock arranca en purchaseReserved, NO al seleccionar. El
// mapeo item→variante se reconstruye desde los picks de las submissions (que
// guardan productId+variantId), sin depender del uuid del PartnerItem.
//
// Fase 1: solo catálogos MANUALES (stock local). Las variantes de Shopify no
// generan filas de reserva (disponibilidad solo optimista); su reserva/fulfillment
// real es Fase 2 (sección 9.6).
import { isProductPick, toPicks } from "@/lib/products/derive"
import { catalogsRepo, getCatalog } from "@/modules/catalogs"
import { listByTransaction as listSubmissions } from "@/modules/submissions"

import * as repo from "./repository"

type PlanEntry = { productId: string; variantId: string; quantity: number }

// Agrega los picks de todas las submissions de la transacción por (producto,
// variante), sumando cantidades. Detecta los picks estructuralmente (objeto con
// productId+variantId) — el resto de las respuestas son strings/números/etc.
async function aggregatePicks(transactionId: string): Promise<Map<string, PlanEntry>> {
  const rows = await listSubmissions(transactionId)
  const agg = new Map<string, PlanEntry>()
  for (const row of rows) {
    for (const value of Object.values(row.answers ?? {})) {
      for (const p of toPicks(value)) {
        if (!isProductPick(p)) continue
        const key = `${p.productId}::${p.variantId}`
        const qty = Math.max(1, p.quantity ?? 1)
        const existing = agg.get(key)
        if (existing) existing.quantity += qty
        else agg.set(key, { productId: p.productId, variantId: p.variantId, quantity: qty })
      }
    }
  }
  return agg
}

// Plan de stock: solo variantes de catálogos MANUALES que trackean stock
// (las únicas que reservan en Fase 1).
async function buildStockPlan(transactionId: string): Promise<PlanEntry[]> {
  const agg = await aggregatePicks(transactionId)
  const entries = [...agg.values()]
  const products = await catalogsRepo.getProducts([...new Set(entries.map((e) => e.productId))])
  const productsById = new Map(products.map((p) => [p.id, p]))
  const catalogSourceCache = new Map<string, string | null>()
  const plan: PlanEntry[] = []
  for (const entry of entries) {
    const product = productsById.get(entry.productId)
    if (!product) continue
    let source = catalogSourceCache.get(product.catalogId)
    if (source === undefined) {
      source = await getCatalog(product.catalogId)
        .then((c) => c.source)
        .catch(() => null)
      catalogSourceCache.set(product.catalogId, source)
    }
    if (source !== "manual") continue // Shopify: Fase 2 (sin reserva local)
    const variant = product.variants.find((v) => v.id === entry.variantId)
    if (!variant || !variant.stockTracked) continue
    plan.push(entry)
  }
  return plan
}

// purchaseReserved → reserva real: inserta holds (idempotente por
// (transactionId, productId, variantId)). expiresAt viene del ack.
export async function reserveStock(
  transactionId: string,
  expiresAt: Date | null,
): Promise<void> {
  const plan = await buildStockPlan(transactionId)
  await Promise.all(
    plan.map((e) =>
      repo.insertHeld({
        transactionId,
        productId: e.productId,
        variantId: e.variantId,
        quantity: e.quantity,
        expiresAt,
      }),
    ),
  )
}

// Aplica deltas de stock agrupando por producto: una lectura/escritura del
// JSONB por producto en vez de una por fila de reserva. `sign` es -1 para
// descontar (fulfillment) y +1 para reponer (refund).
async function applyStockDeltas(
  rows: { productId: string; variantId: string; quantity: number }[],
  sign: 1 | -1,
): Promise<void> {
  const byProduct = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const deltas = byProduct.get(r.productId) ?? new Map<string, number>()
    deltas.set(r.variantId, (deltas.get(r.variantId) ?? 0) + sign * r.quantity)
    byProduct.set(r.productId, deltas)
  }
  for (const [productId, deltas] of byProduct) {
    await catalogsRepo.adjustVariantStocks(productId, deltas)
  }
}

// purchasePaid → fulfillment: hold→consumed y descuento real de stock. Solo
// descuenta las filas que efectivamente pasaron de held a consumed (idempotente:
// un reintento no vuelve a descontar).
export async function confirmStock(transactionId: string): Promise<void> {
  const consumed = await repo.setStatusForTransaction(transactionId, "consumed", "held")
  await applyStockDeltas(consumed, -1)
}

// purchaseExpired → libera los holds (el stock nunca se había descontado).
export async function releaseStock(transactionId: string): Promise<void> {
  await repo.setStatusForTransaction(transactionId, "released", "held")
}

// purchaseRefunded → repone el stock de lo vendido. Refund atómico en Fase 1
// (consistente con el handler actual): repone todas las filas consumed. Solo
// repone las que pasaron de consumed a released (idempotente).
export async function restockOnRefund(transactionId: string): Promise<void> {
  const restocked = await repo.setStatusForTransaction(transactionId, "released", "consumed")
  await applyStockDeltas(restocked, 1)
}
