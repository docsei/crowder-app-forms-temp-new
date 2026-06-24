import { notFound } from "next/navigation"

import { getCatalog, getProduct, listCollections } from "@/modules/catalogs"
import { getConfig } from "@/modules/partner-config"

import { ProductEditor } from "../_components/ProductEditor"

export const dynamic = "force-dynamic"

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string; productId: string }>
}) {
  const { id, productId } = await params
  let catalog
  let product
  try {
    ;[catalog, product] = await Promise.all([getCatalog(id), getProduct(productId)])
  } catch {
    notFound()
  }
  // El producto debe pertenecer al catálogo de la URL.
  if (product.catalogId !== id) notFound()

  const [collections, cfg] = await Promise.all([listCollections(id), getConfig()])

  return (
    <ProductEditor
      catalogId={catalog.id}
      catalogTitle={catalog.title}
      catalogCurrency={catalog.currency}
      collections={collections.map((c) => ({
        id: c.id,
        title: c.title,
        externalId: c.externalId,
      }))}
      supportedCurrencies={cfg?.supportedCurrencies ?? []}
      product={{
        id: product.id,
        title: product.title,
        status: product.status,
        currency: product.currency,
        images: product.images ?? [],
        imageUrl: product.imageUrl,
        refundable: product.refundable,
        externalId: product.externalId,
        variants: product.variants,
        collectionIds: product.collectionIds,
      }}
      readOnly={catalog.source !== "manual"}
    />
  )
}
