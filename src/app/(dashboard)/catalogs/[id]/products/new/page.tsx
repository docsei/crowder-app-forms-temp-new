import { notFound, redirect } from "next/navigation"

import { getCatalog, listCollections } from "@/modules/catalogs"
import { getConfig } from "@/modules/partner-config"

import { ProductEditor } from "../_components/ProductEditor"

export const dynamic = "force-dynamic"

export default async function NewProductPage({
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
  // No se crean productos a mano en un catálogo integrado (los trae el sync).
  if (catalog.source !== "manual") redirect(`/catalogs/${id}`)

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
      product={null}
      readOnly={false}
    />
  )
}
