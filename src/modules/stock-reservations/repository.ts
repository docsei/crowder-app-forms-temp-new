import { and, eq, lt, sql, type InferSelectModel } from "drizzle-orm"

import { db } from "@/lib/db"
import { stockReservations } from "@/lib/db/schema"

export type StockReservation = InferSelectModel<typeof stockReservations>
export type ReservationStatus = "held" | "released" | "consumed"

export async function listByTransaction(
  transactionId: string,
): Promise<StockReservation[]> {
  return db
    .select()
    .from(stockReservations)
    .where(eq(stockReservations.transactionId, transactionId))
}

// Inserta un hold idempotente por (transactionId, productId, variantId): un
// purchaseReserved reenviado no duplica la reserva (mismo espíritu que el dedupe
// de webhook_events). Si ya existe, no hace nada y devuelve la fila existente.
export async function insertHeld(input: {
  transactionId: string
  productId: string
  variantId: string
  quantity: number
  expiresAt: Date | null
}): Promise<StockReservation> {
  const [inserted] = await db
    .insert(stockReservations)
    .values({ ...input, status: "held" })
    .onConflictDoNothing({
      target: [
        stockReservations.transactionId,
        stockReservations.productId,
        stockReservations.variantId,
      ],
    })
    .returning()
  if (inserted) return inserted
  // Ya existía (reintento): devolver la fila vigente.
  const [existing] = await db
    .select()
    .from(stockReservations)
    .where(
      and(
        eq(stockReservations.transactionId, input.transactionId),
        eq(stockReservations.productId, input.productId),
        eq(stockReservations.variantId, input.variantId),
      ),
    )
    .limit(1)
  return existing
}

// Transiciona el estado de todas las reservas de una transacción (al pagar →
// consumed, al expirar → released). Devuelve las filas afectadas para que el
// caller aplique el efecto sobre variant.stock.
export async function setStatusForTransaction(
  transactionId: string,
  to: ReservationStatus,
  from?: ReservationStatus,
): Promise<StockReservation[]> {
  const conds = [eq(stockReservations.transactionId, transactionId)]
  if (from) conds.push(eq(stockReservations.status, from))
  return db
    .update(stockReservations)
    .set({ status: to, updatedAt: new Date() })
    .where(and(...conds))
    .returning()
}

// Suma de unidades en hold de una variante — el restador de disponibilidad:
//   disponible(variante) = variant.stock − heldQuantityForVariant(variantId)
export async function heldQuantityForVariant(
  variantId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${stockReservations.quantity}), 0)` })
    .from(stockReservations)
    .where(
      and(
        eq(stockReservations.variantId, variantId),
        eq(stockReservations.status, "held"),
      ),
    )
  return Number(row?.total ?? 0)
}

// Barrido de holds vencidos: un `held` cuyo expiresAt ya pasó se trata como
// released (definition sección 9.3.1, "Limpieza"). Lo invoca el cron de expiración.
export async function releaseExpired(now: Date): Promise<number> {
  const rows = await db
    .update(stockReservations)
    .set({ status: "released", updatedAt: new Date() })
    .where(
      and(
        eq(stockReservations.status, "held"),
        lt(stockReservations.expiresAt, now),
      ),
    )
    .returning({ id: stockReservations.id })
  return rows.length
}
