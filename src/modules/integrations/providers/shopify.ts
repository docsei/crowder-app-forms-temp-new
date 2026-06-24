import { DomainError } from "@/lib/errors"
import type { ProductOption, ProductStatus, ProductVariant } from "@/lib/db/schema"

import type { ProviderCredential } from "../repository"
import { ProviderError } from "./types"
import type {
  FetchPage,
  NormalizedCollection,
  NormalizedProduct,
  ProductProvider,
  VerifyResult,
} from "./types"

const PAGE_SIZE = 50

// ─── llamada GraphQL al Admin API ───────────────────────────────────────────

type ShopifyConfig = { shopDomain: string; apiVersion: string }

function endpoint(cfg: ShopifyConfig): string {
  // shopDomain ya viene validado en service.validateConfig.
  return `https://${cfg.shopDomain}/admin/api/${cfg.apiVersion}/graphql.json`
}

class ShopifyError extends ProviderError {
  constructor(message: string, retryable: boolean) {
    super(message, retryable)
    this.name = "ShopifyError"
  }
}

async function graphql<T>(
  cred: ProviderCredential,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const cfg = cred.config as ShopifyConfig
  let res: Response
  try {
    res = await fetch(endpoint(cfg), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": cred.secret,
      },
      body: JSON.stringify({ query, variables }),
    })
  } catch (err) {
    // Falla de red / DNS / timeout → reintentable.
    throw new ShopifyError(
      `network error: ${err instanceof Error ? err.message : String(err)}`,
      true,
    )
  }

  // 429 (rate-limit) y 5xx → reintentables; 4xx restantes (401/403 auth) → no.
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    const retryable = res.status === 429 || res.status >= 500
    throw new ShopifyError(`HTTP ${res.status}: ${body.slice(0, 200)}`, retryable)
  }

  const json = (await res.json()) as {
    data?: T
    errors?: Array<{ message: string; extensions?: { code?: string } }>
  }
  if (json.errors?.length) {
    const throttled = json.errors.some(
      (e) => e.extensions?.code === "THROTTLED",
    )
    throw new ShopifyError(
      json.errors.map((e) => e.message).join("; "),
      throttled,
    )
  }
  if (!json.data) throw new ShopifyError("respuesta sin data", false)
  return json.data
}

// ─── verify ─────────────────────────────────────────────────────────────────

const VERIFY_QUERY = /* GraphQL */ `
  query Verify {
    shop { name currencyCode }
  }
`

async function verify(cred: ProviderCredential): Promise<VerifyResult> {
  try {
    const data = await graphql<{
      shop: { name: string; currencyCode: string }
    }>(cred, VERIFY_QUERY)
    return {
      ok: true,
      shopName: data.shop.name,
      currency: data.shop.currencyCode,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── fetchProducts ────────────────────────────────────────────────────────────

const PRODUCTS_QUERY = /* GraphQL */ `
  query Products($cursor: String, $pageSize: Int!) {
    shop { currencyCode }
    products(first: $pageSize, after: $cursor) {
      edges {
        node {
          id
          title
          status
          featuredImage { url }
          options { name values }
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price
                image { url }
                selectedOptions { name value }
                inventoryPolicy
                inventoryQuantity
                inventoryItem { tracked }
              }
            }
          }
          collections(first: 50) {
            edges { node { id handle title } }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

type GqlProductsResponse = {
  shop: { currencyCode: string }
  products: {
    edges: Array<{ node: GqlProduct }>
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  }
}

type GqlProduct = {
  id: string
  title: string
  status: string // ACTIVE | DRAFT | ARCHIVED
  featuredImage: { url: string } | null
  options: Array<{ name: string; values: string[] }>
  variants: { edges: Array<{ node: GqlVariant }> }
  collections: {
    edges: Array<{ node: { id: string; handle: string; title: string } }>
  }
}

type GqlVariant = {
  id: string
  title: string
  sku: string | null
  price: string | null
  image: { url: string } | null
  selectedOptions: Array<{ name: string; value: string }>
  inventoryPolicy: string // DENY | CONTINUE
  inventoryQuantity: number | null
  inventoryItem: { tracked: boolean } | null
}

function mapStatus(s: string): ProductStatus {
  switch (s.toUpperCase()) {
    case "ACTIVE":
      return "active"
    case "ARCHIVED":
      return "archived"
    default:
      return "draft"
  }
}

// Shopify siempre devuelve ≥ 1 opción; un producto sin variantes reales llega
// con options = [{ name: "Title", values: ["Default Title"] }]. Lo tratamos como
// producto simple (options: null), igual que el modelo del repo (definition sección 4.3).
function isDefaultOnly(options: GqlProduct["options"]): boolean {
  return (
    options.length === 1 &&
    options[0].name === "Title" &&
    options[0].values.length === 1 &&
    options[0].values[0] === "Default Title"
  )
}

function mapVariant(v: GqlVariant, productStatus: ProductStatus): ProductVariant {
  // selectedOptions trae la pseudo-opción "Title" para productos simples; la
  // descartamos para que un producto simple quede con options: {}.
  const opts: Record<string, string> = {}
  for (const so of v.selectedOptions) {
    if (so.name === "Title" && so.value === "Default Title") continue
    opts[so.name] = so.value
  }
  const tracked = v.inventoryItem?.tracked ?? false
  return {
    id: v.id, // gid de la variante: estable dentro del producto
    externalId: v.id,
    options: opts,
    title: v.title,
    sku: v.sku ?? null,
    price: v.price != null ? Number(v.price) : null,
    // Shopify hoy solo trae la imagen destacada de la variante; la galería
    // completa (images(first:N)) queda para Fase 2. Portada = images[0].
    images: v.image?.url ? [v.image.url] : [],
    imageUrl: v.image?.url ?? null,
    status: productStatus, // las variantes de Shopify heredan el estado del producto
    stockTracked: tracked,
    stock: tracked ? (v.inventoryQuantity ?? 0) : null,
    oversellPolicy: v.inventoryPolicy?.toUpperCase() === "CONTINUE" ? "continue" : "deny",
  }
}

function mapProduct(node: GqlProduct, currency: string): NormalizedProduct {
  const status = mapStatus(node.status)
  const simple = isDefaultOnly(node.options)
  const options: ProductOption[] | null = simple
    ? null
    : node.options.map((o) => ({ name: o.name, values: o.values }))
  const variants = node.variants.edges.map((e) => mapVariant(e.node, status))
  const collections: NormalizedCollection[] = node.collections.edges.map((e) => ({
    externalId: e.node.id,
    handle: e.node.handle,
    title: e.node.title,
  }))
  return {
    externalId: node.id,
    title: node.title,
    currency,
    images: node.featuredImage?.url ? [node.featuredImage.url] : [],
    imageUrl: node.featuredImage?.url ?? null,
    status,
    refundable: true, // Shopify no expone un flag de devolución por producto
    options,
    variants,
    collections,
    raw: node,
  }
}

async function fetchProducts(
  cred: ProviderCredential,
  cursor?: string,
): Promise<FetchPage> {
  const data = await graphql<GqlProductsResponse>(cred, PRODUCTS_QUERY, {
    cursor: cursor ?? null,
    pageSize: PAGE_SIZE,
  })
  const currency = data.shop.currencyCode
  const items = data.products.edges.map((e) => mapProduct(e.node, currency))
  const { hasNextPage, endCursor } = data.products.pageInfo
  return {
    items,
    nextCursor: hasNextPage && endCursor ? endCursor : undefined,
    currency,
  }
}

function validateConfig(config: unknown): ShopifyConfig {
  const c = (config ?? {}) as Record<string, unknown>
  const shopDomain = String(c.shopDomain ?? "").trim()
  const apiVersion = String(c.apiVersion ?? "").trim()
  if (!shopDomain)
    throw new DomainError(
      "invalid_payload",
      "shopDomain es requerido (ej: tienda.myshopify.com)",
    )
  if (!apiVersion)
    throw new DomainError(
      "invalid_payload",
      "apiVersion es requerido (ej: 2024-10)",
    )
  return { shopDomain, apiVersion }
}

export const shopifyProvider: ProductProvider = {
  provider: "shopify",
  validateConfig,
  verify,
  fetchProducts,
}
