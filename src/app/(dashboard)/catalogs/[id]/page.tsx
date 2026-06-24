import { notFound } from "next/navigation"

import {
  getCatalog,
  listCollections,
  listProducts,
} from "@/modules/catalogs"
import { getConfig } from "@/modules/partner-config"

import { CatalogDetail } from "./_components/CatalogDetail"

export const dynamic = "force-dynamic"

export default async function CatalogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let catalog
  try {
    catalog = await getCatalog(id)
  } catch {
    notFound()
  }
  const [products, collections, cfg] = await Promise.all([
    listProducts(id),
    listCollections(id),
    getConfig(),
  ])

  return (
    <CatalogDetail
      catalog={{
        id: catalog.id,
        title: catalog.title,
        source: catalog.source,
        currency: catalog.currency,
        syncState: catalog.syncState ?? null,
      }}
      collections={collections.map((c) => ({
        id: c.id,
        title: c.title,
        externalId: c.externalId,
      }))}
      products={products.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        currency: p.currency,
        images: p.images ?? [],
        imageUrl: p.imageUrl,
        refundable: p.refundable,
        externalId: p.externalId,
        options: p.options,
        variants: p.variants,
        collectionIds: p.collectionIds,
      }))}
      supportedCurrencies={cfg?.supportedCurrencies ?? []}
    />
  )
}
