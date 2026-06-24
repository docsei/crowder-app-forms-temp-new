import { DomainError, requireNonEmpty } from "@/lib/errors"
import type { Provider, ProviderConfig } from "@/lib/db/schema"

import * as repo from "./repository"
import type { ProviderCredential } from "./repository"
import { getAdapter } from "./providers/registry"
import type { VerifyResult } from "./providers/types"

export type { ProviderCredential }
export type { VerifyResult }

const notFound = () =>
  new DomainError("not_found", "Credencial de proveedor no encontrada")

const requireName = (name: string) =>
  requireNonEmpty(name, "El nombre es requerido")

const requireSecret = (secret: string) =>
  requireNonEmpty(secret, "El secreto es requerido")

// Valida la forma de `config` según el proveedor (los campos no-secretos que
// necesita el adapter, ver definition sección 5). Delega en el adapter: agregar
// un proveedor = implementar su validateConfig + registrarlo, sin tocar acá.
function validateConfig(
  provider: Provider,
  config: unknown,
): ProviderConfig {
  return getAdapter(provider).validateConfig(config)
}

// ─── sección 6.3 Listado ──────────────────────────────────────────────────────────

export async function listCredentials(): Promise<ProviderCredential[]> {
  return repo.list()
}

// ─── sección 6.2 Gestionar la credencial (config + secret) ──────────────────────────

// Credencial efímera (no persistida) para verificar config+secret contra la API
// del proveedor antes de guardar.
function makeDraftCredential(
  provider: Provider,
  config: ProviderConfig,
  secret: string,
): ProviderCredential {
  const now = new Date()
  return {
    id: "draft",
    provider,
    name: "draft",
    config,
    secret,
    active: true,
    deletedAt: null,
    lastSyncedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

// Verifica un par config+secret contra la API del proveedor ANTES de guardar
// (flujo "Conectar", sección 6.2). No persiste nada: arma una credencial efímera y
// delega en el adapter.
export async function verifyDraft(input: {
  provider: Provider
  config: unknown
  secret: string
}): Promise<VerifyResult> {
  const config = validateConfig(input.provider, input.config)
  const draft = makeDraftCredential(
    input.provider,
    config,
    requireSecret(input.secret),
  )
  return getAdapter(input.provider).verify(draft)
}

// Re-verifica una credencial guardada on-demand (sección 6.2), sin tocar `active`.
export async function verifyCredential(id: string): Promise<VerifyResult> {
  const cred = await repo.get(id)
  if (!cred) throw notFound()
  return getAdapter(cred.provider).verify(cred)
}

// Conectar: verifica contra la API del proveedor y, si pasa, persiste la
// credencial (active arranca en true). Si el verify falla, no guarda nada.
export async function createCredential(input: {
  provider: Provider
  name: string
  config: unknown
  secret: string
}): Promise<ProviderCredential> {
  const config = validateConfig(input.provider, input.config)
  const secret = requireSecret(input.secret)
  const verification = await getAdapter(input.provider).verify(
    makeDraftCredential(input.provider, config, secret),
  )
  if (!verification.ok)
    throw new DomainError(
      "invalid_payload",
      `no se pudo conectar con ${input.provider}: ${verification.error}`,
    )
  return repo.insert({
    provider: input.provider,
    name: requireName(input.name),
    config,
    secret,
  })
}

export async function renameCredential(
  id: string,
  name: string,
): Promise<void> {
  const updated = await repo.update(id, { name: requireName(name) })
  if (!updated) throw notFound()
}

// Reemplazar el secreto cuando el tercero lo rota. NO toca `active` (sección 6.2).
export async function rotateSecret(
  id: string,
  secret: string,
): Promise<void> {
  const updated = await repo.update(id, { secret: requireSecret(secret) })
  if (!updated) throw notFound()
}

// ─── sección 6.1 Activar la integración (toggle on/off) ─────────────────────────────

// Prender/apagar la conexión SIN tocar el secreto. Apagar detiene los syncs y
// saca el catálogo integrado de juego; prender la reactiva tal cual estaba.
export async function setCredentialActive(
  id: string,
  active: boolean,
): Promise<void> {
  const updated = await repo.update(id, { active })
  if (!updated) throw notFound()
}

export async function deleteCredential(id: string): Promise<void> {
  // Soft-delete: el guard de catálogos colgando ya no lo da la FK (la fila no se
  // borra), así que lo chequeamos en dominio. Primero hay que migrar/eliminar esos
  // catálogos antes de poder eliminar la credencial.
  if (await repo.hasLinkedCatalogs(id)) {
    throw new DomainError(
      "invalid_payload",
      "No se puede eliminar: hay catálogos usando esta credencial. Migralos o eliminalos primero.",
    )
  }
  await repo.remove(id)
}
