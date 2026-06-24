"use client"

import { RiArrowLeftLine } from "@remixicon/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"

import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Checkbox } from "@/components/Checkbox"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { Switch } from "@/components/Switch"
import { TabNav } from "@/components/dashboard/TabNav"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { CurrencyField } from "@/components/products/CurrencyField"
import { prepareProductImage } from "@/lib/products/image"
import { cx } from "@/lib/utils"
import type { ProductStatus, ProductVariant } from "@/lib/db/schema"

import {
  createProduct,
  deleteProduct,
  updateProduct,
  uploadProductImage,
  type ProductInput,
} from "../../../actions"

export type CollectionRow = { id: string; title: string; externalId: string | null }
export type ProductRow = {
  id: string
  title: string
  status: ProductStatus
  currency: string | null
  images: string[]
  imageUrl: string | null
  refundable: boolean
  externalId: string | null
  variants: ProductVariant[]
  collectionIds: string[]
}

// ─── Borrador de variante ───────────────────────────────────────────────────

type DraftVariant = {
  id: string
  title: string
  sku: string
  price: string
  optionsText: string // "Talla=M, Color=Rojo"
  images: string[] // galería de la variante (portada = images[0])
  stockTracked: boolean
  stock: string
  oversellPolicy: "deny" | "continue"
}

function toDraftVariant(v: ProductVariant): DraftVariant {
  return {
    id: v.id,
    title: v.title,
    sku: v.sku ?? "",
    price: v.price != null ? String(v.price) : "",
    optionsText: Object.entries(v.options)
      .map(([k, val]) => `${k}=${val}`)
      .join(", "),
    images: v.images ?? [],
    stockTracked: v.stockTracked,
    stock: v.stock != null ? String(v.stock) : "",
    oversellPolicy: v.oversellPolicy,
  }
}

function emptyDraftVariant(): DraftVariant {
  return {
    id: "",
    title: "Default Title",
    sku: "",
    price: "",
    optionsText: "",
    images: [],
    stockTracked: false,
    stock: "",
    oversellPolicy: "deny",
  }
}

function parseOptions(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pair of text.split(",")) {
    const [k, ...rest] = pair.split("=")
    const key = k?.trim()
    const value = rest.join("=").trim()
    if (key && value) out[key] = value
  }
  return out
}

// ─── Editor de producto (página) ─────────────────────────────────────────────

export function ProductEditor({
  catalogId,
  catalogTitle,
  catalogCurrency,
  collections,
  supportedCurrencies,
  product,
  readOnly,
}: {
  catalogId: string
  catalogTitle: string
  catalogCurrency: string | null
  collections: CollectionRow[]
  supportedCurrencies: string[]
  product: ProductRow | null
  readOnly: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState(product?.title ?? "")
  const [currency, setCurrency] = useState(product?.currency ?? catalogCurrency ?? "")
  const [images, setImages] = useState<string[]>(product?.images ?? [])
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "active")
  const [refundable, setRefundable] = useState(product?.refundable ?? true)
  const [collectionIds, setCollectionIds] = useState<string[]>(product?.collectionIds ?? [])
  const [variants, setVariants] = useState<DraftVariant[]>(
    product ? product.variants.map(toDraftVariant) : [emptyDraftVariant()],
  )
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"variants" | "collections">("variants")

  const backHref = `/catalogs/${catalogId}`
  const goBack = () => router.push(backHref)

  const toggleCollection = (id: string) =>
    setCollectionIds((cur) =>
      cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id],
    )

  const setVariant = (i: number, patch: Partial<DraftVariant>) =>
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))

  const buildInput = (): ProductInput => ({
    title,
    currency: currency.trim() || null,
    images,
    status,
    refundable,
    collectionIds,
    variants: variants.map((v) => ({
      id: v.id || undefined,
      title: v.title,
      sku: v.sku.trim() || null,
      price: v.price.trim() ? Number(v.price) : null,
      options: parseOptions(v.optionsText),
      images: v.images,
      stockTracked: v.stockTracked,
      stock: v.stockTracked && v.stock.trim() ? Number(v.stock) : null,
      oversellPolicy: v.oversellPolicy,
    })),
  })

  const save = () => {
    setError(null)
    startTransition(async () => {
      const res = product
        ? await updateProduct(product.id, catalogId, buildInput())
        : await createProduct(catalogId, buildInput())
      if (res.ok) goBack()
      else setError(res.error)
    })
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <RiArrowLeftLine className="size-3.5" aria-hidden="true" />
          {catalogTitle}
        </Link>
        {product?.externalId && (
          <span className="font-mono text-xs text-muted-foreground">
            {product.externalId}
          </span>
        )}
      </div>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {product ? product.title || "Producto" : "Nuevo producto"}
          {readOnly && product?.externalId ? " (sincronizado)" : ""}
        </h1>
      </div>

      {readOnly && (
        <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          Producto sincronizado desde el proveedor: solo lectura. Los cambios se
          hacen en el e-commerce y se traen con el sync.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* ── Detalles ── */}
      <Card className="space-y-4 bg-background">
        <h2 className="text-sm font-semibold text-foreground">Detalles</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1">
            <Label>Moneda</Label>
            <CurrencyField
              value={currency}
              onChange={setCurrency}
              supportedCurrencies={supportedCurrencies}
              noneLabel="Hereda del catálogo"
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ProductStatus)}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="archived">archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Imágenes</Label>
            <ImageGalleryEditor
              images={images}
              onChange={setImages}
              disabled={readOnly}
              onError={setError}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch checked={refundable} onCheckedChange={setRefundable} disabled={readOnly} />
            <Label>Admite devolución (refundable)</Label>
          </div>
        </div>
      </Card>

      <TabNav
        active={tab}
        tabs={[
          {
            key: "variants",
            label: `Variantes (${variants.length})`,
            onClick: () => setTab("variants"),
          },
          {
            key: "collections",
            label: `Colecciones (${collectionIds.length})`,
            onClick: () => setTab("collections"),
          },
        ]}
      />

      {/* ── Variantes ── */}
      {tab === "variants" && (
      <div className="space-y-4">
        {/* Ayuda: cada variante es una combinación vendible del producto (una
            talla, un color, etc.). Un producto sin variaciones igual necesita al
            menos una variante con su precio y stock. */}
        <div className="space-y-1 rounded-md bg-subtle/50 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Cómo cargar las variantes</p>
          <p>
            Cada variante es una versión vendible del producto: una combinación
            concreta de talla, color u otra opción. Si el producto no tiene
            variaciones, dejá una sola variante con su precio.
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>
              <span className="text-foreground">Título</span>: nombre visible de
              la combinación (ej: <em>M / Rojo</em>).
            </li>
            <li>
              <span className="text-foreground">Opciones</span>: pares
              <em> clave=valor</em> separados por coma (ej:{" "}
              <em>Talla=M, Color=Rojo</em>). Es lo que distingue una variante de
              otra.
            </li>
            <li>
              <span className="text-foreground">SKU</span>: código interno único;
              opcional pero recomendado para conciliar inventario.
            </li>
            <li>
              <span className="text-foreground">Precio</span>: puede variar por
              variante (ej: tallas grandes más caras).
            </li>
            <li>
              <span className="text-foreground">Imágenes</span>: si las dejás
              vacías, la variante hereda las del producto.
            </li>
            <li>
              <span className="text-foreground">Stock</span>: por defecto es
              ilimitado. Activá &ldquo;Controlar stock&rdquo; para fijar una
              cantidad disponible.
            </li>
          </ul>
        </div>

        <Card className="overflow-hidden bg-background p-0">
        <TableRoot>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="min-w-44">Título</TableHeaderCell>
                <TableHeaderCell className="min-w-48">Opciones</TableHeaderCell>
                <TableHeaderCell className="min-w-32">SKU</TableHeaderCell>
                <TableHeaderCell className="min-w-28">Precio</TableHeaderCell>
                <TableHeaderCell className="min-w-56">Stock</TableHeaderCell>
                <TableHeaderCell className="min-w-48">Imágenes</TableHeaderCell>
                {!readOnly && (
                  <TableHeaderCell className="w-px text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHeaderCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {variants.map((v, i) => (
                <TableRow key={i} className="align-top">
                  <TableCell>
                    <Input
                      value={v.title}
                      onChange={(e) => setVariant(i, { title: e.target.value })}
                      placeholder="M / Rojo"
                      disabled={readOnly}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={v.optionsText}
                      onChange={(e) => setVariant(i, { optionsText: e.target.value })}
                      placeholder="Talla=M, Color=Rojo"
                      disabled={readOnly}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={v.sku}
                      onChange={(e) => setVariant(i, { sku: e.target.value })}
                      placeholder="SKU"
                      disabled={readOnly}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={v.price}
                      onChange={(e) => setVariant(i, { price: e.target.value })}
                      placeholder="15000.50"
                      inputMode="decimal"
                      disabled={readOnly}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={v.stockTracked}
                          onCheckedChange={(c) => setVariant(i, { stockTracked: c === true })}
                          disabled={readOnly}
                        />
                        <span className="text-muted-foreground">
                          {v.stockTracked ? "Controlar stock" : "Stock ilimitado"}
                        </span>
                      </label>
                      {v.stockTracked && (
                        <div className="space-y-2 pl-6">
                          <label className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Cantidad</span>
                            <Input
                              className="w-24"
                              value={v.stock}
                              onChange={(e) => setVariant(i, { stock: e.target.value })}
                              placeholder="0"
                              inputMode="numeric"
                              disabled={readOnly}
                            />
                          </label>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={v.oversellPolicy === "continue"}
                              onCheckedChange={(c) =>
                                setVariant(i, {
                                  oversellPolicy: c === true ? "continue" : "deny",
                                })
                              }
                              disabled={readOnly}
                            />
                            Seguir vendiendo sin stock (backorder)
                          </label>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ImageGalleryEditor
                      images={v.images}
                      onChange={(next) => setVariant(i, { images: next })}
                      disabled={readOnly}
                      onError={setError}
                      compact
                    />
                  </TableCell>
                  {!readOnly && (
                    <TableCell className="text-right">
                      {variants.length > 1 && (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground transition hover:text-red-600"
                          onClick={() =>
                            setVariants((vs) => vs.filter((_, idx) => idx !== i))
                          }
                        >
                          Quitar
                        </button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableRoot>
        </Card>

        {!readOnly && (
          <Button
            variant="ghost"
            onClick={() => setVariants((vs) => [...vs, emptyDraftVariant()])}
          >
            + Agregar variante
          </Button>
        )}
      </div>
      )}

      {/* ── Colecciones ── */}
      {tab === "collections" && (
      <Card className="space-y-4 bg-background">
        {collections.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {collections.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={collectionIds.includes(c.id)}
                  onCheckedChange={() => !readOnly && toggleCollection(c.id)}
                  disabled={readOnly}
                />
                {c.title}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Este catálogo todavía no tiene colecciones. Creá colecciones en la
            pestaña Colecciones del catálogo.
          </p>
        )}
      </Card>
      )}

      {/* ── Acciones ── */}
      <div className="flex items-center gap-2">
        {readOnly ? (
          <Button variant="secondary" onClick={goBack}>
            Volver
          </Button>
        ) : (
          <>
            <Button disabled={pending || !title.trim()} onClick={save}>
              Guardar
            </Button>
            <Button variant="ghost" onClick={goBack}>
              Cancelar
            </Button>
            {product && (
              <Button
                variant="ghost"
                disabled={pending}
                className="ml-auto text-red-600 hover:text-red-700"
                onClick={() => {
                  if (!confirm(`¿Eliminar "${product.title}"?`)) return
                  startTransition(async () => {
                    const res = await deleteProduct(product.id, catalogId)
                    if (res.ok) goBack()
                    else setError(res.error)
                  })
                }}
              >
                Eliminar
              </Button>
            )}
          </>
        )}
      </div>
    </main>
  )
}

// ─── Galería de imágenes ─────────────────────────────────────────────────────

// Editor de galería: sube N imágenes (reescaladas a WebP por prepareProductImage),
// permite quitar y elegir portada. La portada es siempre images[0]; el servidor
// deriva imageUrl/snapshot desde ahí, así que acá solo manejamos el array ordenado.
// `compact` reduce el tamaño de las miniaturas para usarlo dentro de una celda.
function ImageGalleryEditor({
  images,
  onChange,
  disabled,
  onError,
  compact,
}: {
  images: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  onError: (msg: string | null) => void
  compact?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (files.length === 0) return
    onError(null)
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of files) {
        const prepared = await prepareProductImage(file)
        if (!prepared.ok) {
          onError(prepared.error)
          continue
        }
        const fd = new FormData()
        fd.set("file", prepared.file)
        const res = await uploadProductImage(fd)
        if (res.ok) uploaded.push(res.value.url)
        else onError(res.error)
      }
      if (uploaded.length) onChange([...images, ...uploaded])
    } finally {
      setUploading(false)
    }
  }

  const removeAt = (i: number) => onChange(images.filter((_, idx) => idx !== i))
  // Mueve la imagen i al frente (= portada), preservando el orden del resto.
  const makeCover = (i: number) =>
    onChange([images[i], ...images.filter((_, idx) => idx !== i)])

  const thumb = compact ? "size-12" : "size-16"

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={`${url}-${i}`} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className={cx(
                  "rounded-md border object-cover",
                  thumb,
                  i === 0 ? "border-foreground" : "border-border",
                )}
              />
              {i === 0 && (
                <span className="absolute left-0 top-0 rounded-br-md rounded-tl-md bg-foreground px-1 text-[9px] font-medium text-background">
                  portada
                </span>
              )}
              {!disabled && (
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/55 px-1 py-0.5 opacity-0 transition group-hover:opacity-100">
                  {i !== 0 && (
                    <button
                      type="button"
                      className="text-[9px] text-white hover:underline"
                      onClick={() => makeCover(i)}
                    >
                      portada
                    </button>
                  )}
                  <button
                    type="button"
                    className="ml-auto text-[9px] text-white hover:underline"
                    onClick={() => removeAt(i)}
                  >
                    quitar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading
              ? "Subiendo…"
              : images.length
                ? "Agregar imágenes"
                : "Subir imágenes"}
          </Button>
          {!compact && images.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {images.length} {images.length === 1 ? "imagen" : "imágenes"} · la
              primera es la portada
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFiles}
          />
        </div>
      )}
    </div>
  )
}
