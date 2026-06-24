import type { Provider } from "@/lib/db/schema"

// Metadata de cada proveedor: cómo se muestra y qué campos (no-secretos) pide su
// `config`. Agregar VTEX = sumar su entrada acá; la UI se arma sola (definition
// sección 5 / 12). Compartido entre la lista de integraciones y la página de
// detalle de cada proveedor.
export const PROVIDER_FIELDS: Record<
  Provider,
  {
    label: string
    description: string
    secretLabel: string
    fields: { key: string; label: string; placeholder: string }[]
  }
> = {
  shopify: {
    label: "Shopify",
    description: "Sincronizá tu catálogo de productos desde una tienda Shopify.",
    secretLabel: "Admin API access token",
    fields: [
      { key: "shopDomain", label: "Dominio de la tienda", placeholder: "tienda.myshopify.com" },
      { key: "apiVersion", label: "Versión de API", placeholder: "2024-10" },
    ],
  },
  vtex: {
    label: "VTEX",
    description: "Sincronizá tu catálogo de productos desde VTEX.",
    secretLabel: "appKey:appToken",
    fields: [
      { key: "accountName", label: "Account name", placeholder: "miempresa" },
      { key: "environment", label: "Environment", placeholder: "vtexcommercestable" },
    ],
  },
}

export type ProviderMeta = (typeof PROVIDER_FIELDS)[Provider]

export type CredentialView = {
  id: string
  provider: Provider
  name: string
  config: Record<string, unknown>
  active: boolean
  secretPreview: string
  lastSyncedAt: string | null
  createdAt: string
}
