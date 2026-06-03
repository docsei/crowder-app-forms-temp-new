import { NextResponse } from "next/server"

import {
  DomainError,
  errorEnvelope,
  statusForCode,
  type DomainErrorCode,
} from "@/lib/errors"

export function jsonError(
  code: DomainErrorCode,
  message: string,
  details?: Record<string, unknown>,
): NextResponse {
  const err = new DomainError(code, message, details)
  return NextResponse.json(errorEnvelope(err), { status: statusForCode(code) })
}

export function jsonDomainError(err: DomainError): NextResponse {
  return NextResponse.json(errorEnvelope(err), { status: statusForCode(err.code) })
}

// NOTA DE SEGURIDAD: el header `Origin` solo es de confianza en navegadores.
// Un cliente no-navegador (curl, script) puede falsearlo, así que este check es
// protección anti-CSRF de navegador, NO autenticación. No lo trates como
// control de acceso fuerte para endpoints que escriben datos.
export function requireAllowedOrigin(
  origin: string | null,
  allowedOrigins: readonly string[],
  sameOrigin?: string,
): { ok: true } | { ok: false; response: NextResponse } {
  // Same-origin requests (iframe → its own backend) are allowed implicitly:
  // the iframe runs on the partner's own origin, so fetch() sends that origin.
  // The postMessage origin allowlist still enforces who can embed us.
  if (origin && sameOrigin && origin === sameOrigin) return { ok: true }
  if (origin && allowedOrigins.includes(origin)) return { ok: true }
  return { ok: false, response: jsonError("auth_invalid", "origin not allowed") }
}
