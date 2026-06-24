import { DomainError } from "@/lib/errors"

// Slug-like normalizer compartido (minúsculas, dígitos, guiones). El prefijo y
// el fallback se parametrizan porque cada dominio (forms, catalogs) usa los
// suyos cuando el slug queda vacío o no empieza por letra.
export function slugify(
  value: string,
  opts: { letterPrefix: string; fallback: string },
): string {
  const base = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 56)
  const withLetter = /^[a-z]/.test(base)
    ? base
    : `${opts.letterPrefix}${base}`.slice(0, 56)
  const trimmed = withLetter.replace(/-+$/g, "")
  return trimmed.length >= 2 ? trimmed : opts.fallback
}

// Slug base + reintentos con sufijo aleatorio hasta encontrar uno libre. `exists`
// es el chequeo de colisión de cada dominio (forms, catalogs, colecciones).
// Lanza invalid_payload si tras 5 intentos sigue colisionando.
export async function uniqueSlug(
  base: string,
  exists: (id: string) => Promise<unknown>,
  errorMessage = "no se pudo generar un slug único",
): Promise<string> {
  if (!(await exists(base))) return base
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 64)
    if (!(await exists(candidate))) return candidate
  }
  throw new DomainError("invalid_payload", errorMessage)
}
