import { DomainError } from "@/lib/errors"
import type { Provider } from "@/lib/db/schema"

import type { ProductProvider } from "./types"
import { shopifyProvider } from "./shopify"

// Registro de adapters: provider -> implementación. Disponibilizar un proveedor
// nuevo = agregar su adapter acá + listarlo en partner_config.enabledProviders
// (definition sección 5 y 12). VTEX (futuro) suma su entrada sin tocar forms.
const ADAPTERS: Partial<Record<Provider, ProductProvider>> = {
  shopify: shopifyProvider,
}

export function getAdapter(provider: Provider): ProductProvider {
  const adapter = ADAPTERS[provider]
  if (!adapter)
    throw new DomainError(
      "invalid_payload",
      `proveedor sin adapter implementado: ${provider}`,
    )
  return adapter
}

// Proveedores con adapter implementado = los que la plataforma puede ofrecer al
// partner para habilitar (nivel "disponible", definition sección 5). VTEX aparecerá
// acá recién cuando se registre su adapter.
export function availableProviders(): Provider[] {
  return Object.keys(ADAPTERS) as Provider[]
}
