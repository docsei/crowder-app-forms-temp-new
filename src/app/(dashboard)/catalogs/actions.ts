"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getServiceSupabase, requireUser } from "@/adapters/supabase/server"
import { type ActionResult, fail } from "@/lib/action-result"
import type {
  CatalogSource,
  ProductOption,
  ProductStatus,
  ProductVariant,
} from "@/lib/db/schema"
import {
  createCatalog as createCatalogSvc,
  createCollection as createCollectionSvc,
  createProduct as createProductSvc,
  deleteCatalog as deleteCatalogSvc,
  deleteCollection as deleteCollectionSvc,
  deleteProduct as deleteProductSvc,
  setCollectionMembership as setCollectionMembershipSvc,
  updateCatalog as updateCatalogSvc,
  updateCollection as updateCollectionSvc,
  updateProduct as updateProductSvc,
} from "@/modules/catalogs"
import { syncCatalog } from "@/modules/integrations"
import { getFormsByIds, listForms } from "@/modules/forms"

// ─── catálogos ──────────────────────────────────────────────────────────────

export async function createCatalog(input: {
  title: string
  source: CatalogSource
  credentialId?: string | null
  currency?: string | null
}): Promise<ActionResult<string>> {
  await requireUser()
  try {
    const cat = await createCatalogSvc(input)
    revalidatePath("/catalogs")
    return { ok: true, value: cat.id }
  } catch (err) {
    return fail(err)
  }
}

export async function updateCatalog(
  id: string,
  patch: { title?: string; currency?: string | null },
): Promise<ActionResult> {
  await requireUser()
  try {
    await updateCatalogSvc(id, patch)
    revalidatePath(`/catalogs/${id}`)
    revalidatePath("/catalogs")
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

// Guard (definition sección 8.5): no se borra un catálogo referenciado por algún
// form PUBLICADO. forms.definition es JSONB sin FK, así que escaneamos en
// dominio las definiciones publicadas buscando una pregunta product con este
// catalogId.
async function catalogReferencedByPublishedForm(
  catalogId: string,
): Promise<string | null> {
  const published = (await listForms()).filter((f) => f.publishedAt)
  const full = await getFormsByIds(published.map((f) => f.id))
  const hit = full.find((form) =>
    form.definition.groups.some((g) =>
      g.questions.some(
        (q) => q.type === "product" && q.product?.catalogId === catalogId,
      ),
    ),
  )
  return hit?.id ?? null
}

export async function deleteCatalog(id: string): Promise<ActionResult> {
  await requireUser()
  try {
    const ref = await catalogReferencedByPublishedForm(id)
    if (ref)
      return {
        ok: false,
        error: `No se puede eliminar: el form publicado '${ref}' usa este catálogo. Quitá la pregunta o despublicá el form primero.`,
      }
    await deleteCatalogSvc(id)
    revalidatePath("/catalogs")
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function runSync(catalogId: string): Promise<
  ActionResult<{ status: string; counts: unknown; errors: string[] }>
> {
  await requireUser()
  try {
    const res = await syncCatalog(catalogId)
    revalidatePath(`/catalogs/${catalogId}`)
    return { ok: true, value: res }
  } catch (err) {
    return fail(err)
  }
}

// ─── colecciones ──────────────────────────────────────────────────────────

export async function createCollection(input: {
  catalogId: string
  title: string
}): Promise<ActionResult> {
  await requireUser()
  try {
    await createCollectionSvc(input)
    revalidatePath(`/catalogs/${input.catalogId}`)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function updateCollection(
  id: string,
  catalogId: string,
  patch: { title?: string; position?: number },
): Promise<ActionResult> {
  await requireUser()
  try {
    await updateCollectionSvc(id, patch)
    revalidatePath(`/catalogs/${catalogId}`)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteCollection(
  id: string,
  catalogId: string,
): Promise<ActionResult> {
  await requireUser()
  try {
    await deleteCollectionSvc(id)
    revalidatePath(`/catalogs/${catalogId}`)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

// ─── productos (manual) ─────────────────────────────────────────────────────

export type ProductInput = {
  title: string
  currency?: string | null
  images?: string[]
  imageUrl?: string | null
  status?: ProductStatus
  refundable?: boolean
  options?: ProductOption[] | null
  variants?: Partial<ProductVariant>[]
  collectionIds?: string[]
}

export async function createProduct(
  catalogId: string,
  input: ProductInput,
): Promise<ActionResult<string>> {
  await requireUser()
  try {
    const p = await createProductSvc({ catalogId, ...input })
    revalidatePath(`/catalogs/${catalogId}`)
    return { ok: true, value: p.id }
  } catch (err) {
    return fail(err)
  }
}

export async function updateProduct(
  id: string,
  catalogId: string,
  input: ProductInput,
): Promise<ActionResult> {
  await requireUser()
  try {
    await updateProductSvc(id, input)
    revalidatePath(`/catalogs/${catalogId}`)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

// Fija en lote la membresía de una colección (set completo de productIds que
// deben quedar dentro). Una sola revalidación, a diferencia de un toggle por
// producto. Lo usa el drawer "Agregar productos" al guardar.
export async function setCollectionProducts(
  collectionId: string,
  catalogId: string,
  productIds: string[],
): Promise<ActionResult> {
  await requireUser()
  try {
    await setCollectionMembershipSvc(catalogId, collectionId, productIds)
    revalidatePath(`/catalogs/${catalogId}`)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteProduct(
  id: string,
  catalogId: string,
): Promise<ActionResult> {
  await requireUser()
  try {
    await deleteProductSvc(id)
    revalidatePath(`/catalogs/${catalogId}`)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

// ─── subida de imagen de producto (Supabase Storage) ───────────────────────

const IMAGE_BUCKET = "product-images"
// Backstop: el cliente ya reescala y comprime a WebP (~30–120 KB) vía
// prepareProductImage, así que un upload normal nunca se acerca. Estos 3 MB
// solo protegen contra una llamada directa a la action.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

// Sube una imagen al bucket público `product-images` y devuelve su URL pública
// (definition sección 10.2). Usa el cliente service-role: crea el bucket si falta y
// no depende de RLS. La lectura es pública (la imagen se muestra en el iframe).
export async function uploadProductImage(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  await requireUser()
  try {
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return { ok: false, error: "No se recibió ningún archivo" }
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { ok: false, error: "Formato no soportado (usá JPG, PNG, WebP o GIF)" }
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: "La imagen supera los 3 MB" }
    }

    const supabase = getServiceSupabase()
    // Crea el bucket público si todavía no existe (idempotente).
    await supabase.storage.createBucket(IMAGE_BUCKET, { public: true }).catch(() => {})

    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
    const path = `${crypto.randomUUID()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadErr) {
      return { ok: false, error: `No se pudo subir: ${uploadErr.message}` }
    }
    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
    return { ok: true, value: { url: data.publicUrl } }
  } catch (err) {
    return fail(err)
  }
}

// ─── import masivo (JSON) ───────────────────────────────────────────────────

const variantImportSchema = z
  .object({
    id: z.string().optional(),
    options: z.record(z.string()).optional(),
    title: z.string().optional(),
    sku: z.string().nullable().optional(),
    price: z.number().nullable().optional(),
    images: z.array(z.string()).optional(),
    imageUrl: z.string().nullable().optional(),
    stockTracked: z.boolean().optional(),
    stock: z.number().nullable().optional(),
    oversellPolicy: z.enum(["deny", "continue"]).optional(),
  })
  .strip()

const productImportSchema = z.object({
  title: z.string().min(1),
  currency: z.string().nullable().optional(),
  images: z.array(z.string()).optional(),
  imageUrl: z.string().nullable().optional(),
  status: z.enum(["active", "draft", "archived"]).optional(),
  refundable: z.boolean().optional(),
  options: z
    .array(z.object({ name: z.string(), values: z.array(z.string()) }))
    .nullable()
    .optional(),
  variants: z.array(variantImportSchema).optional(),
  collectionIds: z.array(z.string()).optional(),
})

const productsImportSchema = z.array(productImportSchema)

// Crea productos en masa desde un JSON (array de productos, mismo shape que el
// export). Aditivo: agrega los del archivo, no reemplaza. Solo catálogos manuales.
export async function importProducts(
  catalogId: string,
  raw: unknown,
): Promise<ActionResult<{ created: number; failed: number }>> {
  await requireUser()
  try {
    const parsed = productsImportSchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return {
        ok: false,
        error: `JSON inválido${first ? `: ${first.path.join(".")} ${first.message}` : ""}`,
      }
    }
    let created = 0
    let failed = 0
    for (const item of parsed.data) {
      try {
        await createProductSvc({ catalogId, ...item })
        created++
      } catch {
        failed++
      }
    }
    revalidatePath(`/catalogs/${catalogId}`)
    return { ok: true, value: { created, failed } }
  } catch (err) {
    return fail(err)
  }
}
