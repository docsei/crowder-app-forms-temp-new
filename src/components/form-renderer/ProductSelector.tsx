"use client"

import { useState } from "react"
import { cx } from "@/lib/utils"
import type { FormQuestion, ProductPick } from "@/lib/db/schema"
import { formatPrice } from "@/lib/products/format"
import { toPicks } from "@/lib/products/derive"
import { buildSnapshot, hasRealVariants } from "@/lib/products/snapshot"
import type { RenderProduct, RenderVariant } from "@/lib/products/types"

// Render de la pregunta `product` (definition sección 8.3).
//
// Dos modos según `max`:
//  - max === 1 → selección única (radio + chips de variante). El value es un
//    ProductPick (o undefined).
//  - max > 1  → CARRITO agrupado por producto: cada variante tiene su stepper
//    `− cantidad +`. Sumar desde 0 agrega la línea; restar a 0 la quita. `max`
//    cuenta UNIDADES totales (suma de cantidades), así el comprador puede mezclar
//    tallas o llevar varias de una misma talla. El value es un ProductPick[].
//
// El total y el botón "Continuar" los pone Crowder (no acá); acá solo mostramos
// un total informativo cuando showPrice está activo.
// Imágenes activas de un producto: si la variante elegida tiene galería propia,
// manda esa; si no, cae a la del producto (y a la portada legacy como último recurso).
function galleryFor(p: RenderProduct, v?: RenderVariant): string[] {
  const vi = v?.images ?? []
  if (vi.length) return vi
  if (p.images.length) return p.images
  return p.imageUrl ? [p.imageUrl] : []
}

// Miniatura grande + tira de thumbnails para cambiar la imagen mostrada. Sin
// imágenes no renderiza nada (el layout se reacomoda solo).
function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [idx, setIdx] = useState(0)
  if (images.length === 0) return null
  const active = Math.min(idx, images.length - 1)
  return (
    <div className="shrink-0 space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[active]}
        alt={alt}
        className="size-16 rounded-md object-cover"
      />
      {images.length > 1 && (
        <div className="flex gap-1">
          {images.slice(0, 4).map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Imagen ${i + 1} de ${alt}`}
              className={cx(
                "size-4 overflow-hidden rounded-sm border transition",
                i === active ? "border-primary" : "border-border",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ProductSelector({
  config,
  products,
  value,
  onChange,
  currency,
}: {
  config: FormQuestion["product"]
  products: RenderProduct[]
  value: unknown
  onChange: (v: unknown) => void
  currency?: string | null
}) {
  const max = config?.max ?? 1
  const single = max === 1
  const min = config?.min ?? 0
  const allowQuantity = config?.allowQuantity ?? false
  const showPrice = config?.showPrice ?? false

  const picks = toPicks(value)

  if (products.length === 0) {
    return (
      <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
        No hay productos disponibles para esta pregunta.
      </p>
    )
  }

  const firstSellableVariant = (p: RenderProduct): RenderVariant =>
    p.variants.find((v) => v.sellable) ?? p.variants[0]

  const makePick = (
    p: RenderProduct,
    variant: RenderVariant,
    quantity: number,
  ): ProductPick => ({
    productId: p.id,
    variantId: variant.id,
    ...(allowQuantity ? { quantity } : {}),
    snapshot: buildSnapshot(p, variant),
  })

  const emit = (next: ProductPick[]) => {
    onChange(single ? (next[0] ?? undefined) : next)
  }

  const lineFor = (productId: string, variantId: string) =>
    picks.find((p) => p.productId === productId && p.variantId === variantId)

  // ───────────────────────── Modo único (max === 1) ─────────────────────────
  if (single) {
    const selected = picks[0]
    const selectVariant = (p: RenderProduct, v: RenderVariant) => {
      if (selected?.productId === p.id && selected?.variantId === v.id) {
        emit([]) // toca de nuevo → deselecciona
      } else {
        emit([makePick(p, v, 1)])
      }
    }

    return (
      <div className="space-y-3">
        {products.map((p) => {
          const soldOut = !p.variants.some((v) => v.sellable)
          const multiVariant = hasRealVariants(p)
          const isSelectedProduct = selected?.productId === p.id
          const defaultVariant =
            (isSelectedProduct &&
              p.variants.find((v) => v.id === selected?.variantId)) ||
            firstSellableVariant(p)

          return (
            <div
              key={p.id}
              className={cx(
                "rounded-lg border bg-background p-3 transition",
                isSelectedProduct ? "border-primary bg-primary/5" : "border-border",
                soldOut && "opacity-60",
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  className="mt-1"
                  checked={isSelectedProduct}
                  disabled={soldOut}
                  onChange={() => selectVariant(p, defaultVariant)}
                  aria-label={p.title}
                />
                <ProductGallery images={galleryFor(p, defaultVariant)} alt={p.title} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium text-foreground">{p.title}</p>
                    {showPrice && defaultVariant.price != null && (
                      <span className="shrink-0 text-sm text-foreground">
                        {formatPrice(defaultVariant.price, p.currency ?? currency)}
                      </span>
                    )}
                  </div>
                  {soldOut && (
                    <p className="text-xs text-muted-foreground">Agotado</p>
                  )}
                  {multiVariant && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.variants.map((v) => {
                        const active =
                          isSelectedProduct && selected?.variantId === v.id
                        return (
                          <button
                            key={v.id}
                            type="button"
                            disabled={!v.sellable}
                            onClick={() => selectVariant(p, v)}
                            className={cx(
                              "rounded-md border px-2 py-1 text-xs transition",
                              active
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-secondary-foreground hover:bg-subtle",
                              !v.sellable &&
                                "cursor-not-allowed line-through opacity-50",
                            )}
                          >
                            {v.title}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ──────────────────────── Modo carrito (max > 1) ─────────────────────────
  const totalUnits = picks.reduce((n, p) => n + (p.quantity ?? 1), 0)
  const atMax = totalUnits >= max
  const remaining = max - totalUnits

  const qtyOf = (productId: string, variantId: string): number => {
    const line = lineFor(productId, variantId)
    return line ? (line.quantity ?? 1) : 0
  }

  // Fija la cantidad de una línea (producto+variante). 0 → la quita del carrito.
  // Sin allowQuantity la línea no puede pasar de 1 (acto de toggle).
  const setQty = (p: RenderProduct, v: RenderVariant, qty: number) => {
    const existing = lineFor(p.id, v.id)
    const target = allowQuantity ? qty : Math.min(qty, 1)
    if (target < 1) {
      if (existing)
        emit(picks.filter((x) => !(x.productId === p.id && x.variantId === v.id)))
      return
    }
    const currentQty = existing ? (existing.quantity ?? 1) : 0
    const delta = target - currentQty
    if (delta > 0 && totalUnits + delta > max) return
    if (existing) {
      emit(
        picks.map((x) =>
          x.productId === p.id && x.variantId === v.id
            ? makePick(p, v, target)
            : x,
        ),
      )
    } else {
      emit([...picks, makePick(p, v, target)])
    }
  }

  // Total informativo del carrito (el autoritativo lo calcula el servidor).
  const cartTotal = picks.reduce(
    (sum, p) => sum + (p.snapshot.price ?? 0) * (p.quantity ?? 1),
    0,
  )
  const cartCurrency = picks[0]?.snapshot.currency ?? currency

  return (
    <div className="space-y-3">
      {products.map((p) => {
        const soldOut = !p.variants.some((v) => v.sellable)
        const multiVariant = hasRealVariants(p)
        const headVariant = firstSellableVariant(p)
        const productUnits = picks
          .filter((x) => x.productId === p.id)
          .reduce((n, x) => n + (x.quantity ?? 1), 0)

        return (
          <div
            key={p.id}
            className={cx(
              "rounded-lg border bg-background p-3 transition",
              productUnits > 0 ? "border-primary bg-primary/5" : "border-border",
              soldOut && "opacity-60",
            )}
          >
            <div className="flex items-start gap-3">
              <ProductGallery images={galleryFor(p)} alt={p.title} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-foreground">{p.title}</p>
                  {showPrice && !multiVariant && headVariant.price != null && (
                    <span className="shrink-0 text-sm text-foreground">
                      {formatPrice(headVariant.price, p.currency ?? currency)}
                    </span>
                  )}
                </div>
                {soldOut && (
                  <p className="text-xs text-muted-foreground">Agotado</p>
                )}

                {/* Una fila por variante (o una sola si el producto no tiene
                    variantes reales), cada una con su stepper de cantidad. */}
                {!soldOut && (
                  <div className="mt-2 space-y-1.5">
                    {p.variants.map((v) => {
                      const qty = qtyOf(p.id, v.id)
                      const canAdd = v.sellable && (qty > 0 || !atMax)
                      const label = multiVariant ? v.title : p.title
                      return (
                        <div
                          key={v.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <div className="flex min-w-0 items-baseline gap-2">
                            <span
                              className={cx(
                                "truncate text-sm",
                                qty > 0
                                  ? "text-foreground"
                                  : "text-secondary-foreground",
                                !v.sellable &&
                                  "text-muted-foreground line-through",
                              )}
                            >
                              {label}
                            </span>
                            {showPrice && v.price != null && (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {formatPrice(v.price, p.currency ?? currency)}
                              </span>
                            )}
                          </div>

                          {!v.sellable ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              Agotado
                            </span>
                          ) : qty === 0 ? (
                            <button
                              type="button"
                              disabled={!canAdd}
                              onClick={() => setQty(p, v, 1)}
                              className="shrink-0 rounded-md border border-border px-3 py-1 text-xs text-secondary-foreground transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Agregar
                            </button>
                          ) : allowQuantity ? (
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                className="size-6 rounded border border-border text-sm"
                                onClick={() => setQty(p, v, qty - 1)}
                                aria-label={`Quitar una unidad de ${label}`}
                              >
                                −
                              </button>
                              <span className="w-5 text-center text-sm">
                                {qty}
                              </span>
                              <button
                                type="button"
                                className="size-6 rounded border border-border text-sm disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={atMax}
                                onClick={() => setQty(p, v, qty + 1)}
                                aria-label={`Agregar una unidad de ${label}`}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setQty(p, v, 0)}
                              className="shrink-0 rounded-md border border-primary bg-primary/10 px-3 py-1 text-xs text-primary transition"
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {totalUnits}/{max} {totalUnits === 1 ? "unidad" : "unidades"}
          {totalUnits < min
            ? ` · elegí al menos ${min}`
            : !atMax && remaining > 0
              ? ` · podés agregar ${remaining} más`
              : ""}
        </span>
        {showPrice && cartTotal > 0 && (
          <span className="font-medium text-foreground">
            {formatPrice(cartTotal, cartCurrency)}
          </span>
        )}
      </div>
    </div>
  )
}
