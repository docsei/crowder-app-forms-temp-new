// Normalización de imágenes de producto en el navegador antes de subir
// (definition sección 10.2). En el plan Free de Supabase no hay transformación
// al servir, así que guardamos directo lo que se va a mostrar: reescalamos a un
// lado máximo y comprimimos a WebP. Inspirado en cómo Shopify acota el original
// (acepta grande, sirve chico) pero hecho 100% del lado del cliente.

// Lado máximo del lado mayor de la imagen. El thumbnail se muestra a 64px;
// 800px deja margen para retina y cards más grandes a futuro.
const MAX_DIMENSION = 800
// Cota del original que aceptamos procesar (evita cargar monstruos a memoria).
const MAX_SOURCE_BYTES = 15 * 1024 * 1024
const OUTPUT_TYPE = "image/webp"
const OUTPUT_QUALITY = 0.82

export type PreparedImage =
  | { ok: true; file: File }
  | { ok: false; error: string }

// Carga el archivo, lo reescala a MAX_DIMENSION manteniendo aspecto y lo
// reexporta como WebP. Devuelve un File listo para subir (típico 30–120 KB).
export async function prepareProductImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "El archivo no es una imagen" }
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, error: "La imagen supera los 15 MB" }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { ok: false, error: "No se pudo leer la imagen (¿archivo dañado?)" }
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return { ok: false, error: "No se pudo procesar la imagen" }
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY),
    )
    if (!blob) return { ok: false, error: "No se pudo procesar la imagen" }

    const base = file.name.replace(/\.[^.]+$/, "") || "imagen"
    const out = new File([blob], `${base}.webp`, { type: OUTPUT_TYPE })
    return { ok: true, file: out }
  } finally {
    bitmap.close()
  }
}
