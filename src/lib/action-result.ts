import { DomainError } from "@/lib/errors"

// Las server actions devuelven envoltorios serializables {ok,...} en vez de
// dejar propagar el DomainError, así la UI muestra el error inline sin romper.
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; error: string }

export function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof DomainError) return { ok: false, error: err.message }
  return { ok: false, error: err instanceof Error ? err.message : "Error inesperado" }
}
