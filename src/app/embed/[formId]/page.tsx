import { notFound } from "next/navigation"

import { findPublished } from "@/modules/forms"
import { getConfig } from "@/modules/partner-config"
import { resolveListing, toRenderProduct } from "@/modules/catalogs"
import { EmbedWizard } from "@/components/embed/EmbedWizard"
import type { ProductLists } from "@/lib/products/types"
import { resolveAllowedOrigins } from "@/lib/origins"
import { embedThemeStyle } from "@/lib/theme"

export const dynamic = "force-dynamic"

export default async function EmbedFormPage({
  params,
}: {
  params: Promise<{ formId: string }>
}) {
  const { formId } = await params
  const [published, cfg] = await Promise.all([findPublished(formId), getConfig()])

  if (!published) notFound()

  // Resolver el listado de cada pregunta `product` (definition sección 8): la
  // pregunta nunca habla con Shopify en render, lee del catálogo local. Las
  // listas viajan al wizard como render-safe, clave `${formId}::${questionId}`.
  const productLists: ProductLists = {}
  const productQuestions = published.version.definition.groups.flatMap((group) =>
    group.questions.filter((q) => q.type === "product" && q.product),
  )
  const resolved = await Promise.all(
    productQuestions.map((q) => resolveListing(q.product!)),
  )
  productQuestions.forEach((q, i) => {
    productLists[`${published.form.id}::${q.id}`] = resolved[i].map(toRenderProduct)
  })

  const themeCss = embedThemeStyle(
    published.form.theme ?? cfg?.theme ?? null,
  )

  return (
    <main
      data-embed-page
      className="min-h-screen bg-background text-foreground antialiased"
    >
      {themeCss && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}
      <EmbedWizard
        forms={[
          {
            id: published.form.id,
            title: published.form.title,
            version: published.version.version,
            definition: published.version.definition,
          },
        ]}
        supportedCurrencies={cfg?.supportedCurrencies ?? []}
        productLists={productLists}
        parentOrigins={resolveAllowedOrigins(
          published.form.allowedOrigins,
          cfg?.allowedOrigins ?? [],
        )}
        formIdForDiagnostics={published.form.id}
      />
    </main>
  )
}
