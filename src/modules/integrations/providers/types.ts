import type {
  Provider,
  ProductOption,
  ProductStatus,
  ProductVariant,
  ProviderConfig,
} from "@/lib/db/schema"

import type { ProviderCredential } from "../repository"

// Error que un adapter lanza durante fetch/verify. `retryable` es contrato del
// proveedor (timeout/429/5xx = sí, auth/payload = no): el motor de sync lo lee
// para decidir reintentos sin conocer la implementación concreta del adapter.
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message)
    this.name = "ProviderError"
  }
}

// Resultado de verify(): éxito con datos mínimos de la tienda, o fallo con motivo.
export type VerifyResult =
  | { ok: true; shopName?: string; currency?: string; scopes?: string[] }
  | { ok: false; error: string }

// Colección tal como la trae el adapter; el sync la upserta como fila
// `collections` (resolviendo el slug `id`) y deriva la membresía a
// `products.collectionIds` (ver definition sección 7.2).
export type NormalizedCollection = {
  externalId: string // id de la collection en el proveedor; clave de upsert
  handle: string // slug estable → base del collections.id
  title: string
}

// Forma común a la que cada adapter normaliza un producto del proveedor antes de
// upsertarlo (definition sección 5). El sync lo mapea 1:1 a una fila `products`:
// externalId no nulo (clave de upsert), options/variants ya en formato del repo.
// No incluye id/catalogId/createdAt (los pone el upsert).
export type NormalizedProduct = {
  externalId: string
  title: string
  currency: string | null
  images: string[] // galería del producto (portada = images[0])
  imageUrl: string | null
  status: ProductStatus
  refundable: boolean
  options: ProductOption[] | null
  variants: ProductVariant[] // SIEMPRE ≥ 1; cada variante con su externalId
  collections: NormalizedCollection[]
  raw: unknown // payload crudo del proveedor (auditoría)
}

export type FetchPage = {
  items: NormalizedProduct[]
  nextCursor?: string
  // Moneda de la tienda (Shopify: Shop.currencyCode). En Shopify el precio de cada
  // variante es Money en la moneda default de la tienda: no hay moneda por producto,
  // es una propiedad a nivel tienda. El sync la persiste en catalogs.currency.
  currency: string | null
}

// Un proveedor = un adapter (definition sección 5). Shopify es la base de Fase 1;
// agregar VTEX = otro adapter + entrada en el registro, sin tocar forms.
export interface ProductProvider {
  provider: Provider
  // Valida/normaliza los campos no-secretos de `config` que necesita el adapter
  // (definition sección 5). Lanza DomainError("invalid_payload") si faltan.
  validateConfig(config: unknown): ProviderConfig
  // Valida que la credencial conecta (ping a la API del proveedor).
  verify(cred: ProviderCredential): Promise<VerifyResult>
  // Trae productos (paginado por cursor) para sincronizar el catálogo.
  fetchProducts(cred: ProviderCredential, cursor?: string): Promise<FetchPage>
}
