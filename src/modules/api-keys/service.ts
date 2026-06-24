import { randomBytes } from "crypto"

import { DomainError, requireNonEmpty } from "@/lib/errors"

import * as repo from "./repository"
import type { ApiKey } from "./repository"

export type { ApiKey }

// Ventana de gracia tras regenerar: el secreto anterior sigue aceptándose
// durante este lapso para no cortar integraciones en vivo mientras el partner
// despliega el secreto nuevo.
export const GRACE_MS = 24 * 60 * 60 * 1000

function generateSecret(): string {
  return randomBytes(32).toString("base64url")
}

const requireName = (name: string) =>
  requireNonEmpty(name, "El nombre es requerido")

const notFound = () => new DomainError("not_found", "API key no encontrada")

/**
 * Devuelve la fecha de expiración del secreto anterior si todavía está dentro
 * de la ventana de gracia, o `null` si ya venció (o nunca existió). Centraliza
 * la regla de gracia que consumen tanto `acceptedApiKeys` como la UI de settings.
 */
export function graceActiveUntil(
  expiresAt: Date | null,
  now: number = Date.now(),
): Date | null {
  return expiresAt && expiresAt.getTime() > now ? expiresAt : null
}

export async function listApiKeys(): Promise<ApiKey[]> {
  return repo.list()
}

export async function createApiKey(name: string): Promise<ApiKey> {
  return repo.insert({ name: requireName(name), secret: generateSecret() })
}

export async function renameApiKey(id: string, name: string): Promise<void> {
  const updated = await repo.update(id, { name: requireName(name) })
  if (!updated) throw notFound()
}

export async function regenerateApiKey(id: string): Promise<ApiKey> {
  const current = await repo.get(id)
  if (!current) throw notFound()
  const updated = await repo.update(id, {
    secret: generateSecret(),
    secretPrevious: current.secret,
    secretPreviousExpiresAt: new Date(Date.now() + GRACE_MS),
  })
  if (!updated) throw notFound()
  return updated
}

export async function setApiKeyActive(
  id: string,
  active: boolean,
): Promise<void> {
  const updated = await repo.update(id, { active })
  if (!updated) throw notFound()
}

export async function deleteApiKey(id: string): Promise<void> {
  await repo.remove(id)
}

/**
 * Secretos aceptados para validar el Bearer: el secreto actual de cada key
 * activa, más el secreto anterior mientras siga dentro de la ventana de gracia.
 * Las keys desactivadas no aportan ningún secreto.
 */
export async function acceptedApiKeys(): Promise<string[]> {
  const now = Date.now()
  const keys = await repo.listActive()
  const secrets: string[] = []
  for (const k of keys) {
    secrets.push(k.secret)
    if (k.secretPrevious && graceActiveUntil(k.secretPreviousExpiresAt, now)) {
      secrets.push(k.secretPrevious)
    }
  }
  return secrets
}
