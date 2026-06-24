import type { ProductSnapshot, RenderProduct, RenderVariant } from "./types"

// ¿El producto tiene variantes "reales" (talla/color), o es simple (una sola
// variante default)? Determina si el snapshot guarda variantTitle/options.
export function hasRealVariants(product: {
  variants: { options: Record<string, string> }[]
}): boolean {
  return (
    product.variants.length > 1 ||
    Object.keys(product.variants[0]?.options ?? {}).length > 0
  )
}

// Congela la variante elegida en el snapshot del ProductPick (definition
// sección 8.1): imagen resuelta como variant.imageUrl ?? product.imageUrl.
export function buildSnapshot(
  product: RenderProduct,
  variant: RenderVariant,
): ProductSnapshot {
  const real = hasRealVariants(product)
  return {
    title: product.title,
    variantTitle: real ? variant.title : null,
    options: real && Object.keys(variant.options).length ? variant.options : null,
    sku: variant.sku,
    price: variant.price,
    currency: product.currency,
    imageUrl: variant.imageUrl ?? product.imageUrl,
  }
}
