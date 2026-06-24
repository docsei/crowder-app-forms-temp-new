import { and, desc, eq, isNull, type InferSelectModel } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  catalogs,
  providerCredentials,
  type Provider,
  type ProviderConfig,
} from "@/lib/db/schema"

export type ProviderCredential = InferSelectModel<typeof providerCredentials>

export async function list(): Promise<ProviderCredential[]> {
  return db
    .select()
    .from(providerCredentials)
    .where(isNull(providerCredentials.deletedAt))
    .orderBy(desc(providerCredentials.createdAt))
}

export async function listActive(): Promise<ProviderCredential[]> {
  return db
    .select()
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.active, true),
        isNull(providerCredentials.deletedAt),
      ),
    )
}

export async function get(id: string): Promise<ProviderCredential | null> {
  const [row] = await db
    .select()
    .from(providerCredentials)
    .where(
      and(eq(providerCredentials.id, id), isNull(providerCredentials.deletedAt)),
    )
    .limit(1)
  return row ?? null
}

// ¿Hay algún catálogo (vivo) usando esta credencial? Antes lo garantizaba la FK
// catalogs.credentialId con onDelete: restrict; al pasar a soft-delete la FK ya no
// dispara (la fila no se borra), así que el guard se chequea en dominio.
export async function hasLinkedCatalogs(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: catalogs.id })
    .from(catalogs)
    .where(and(eq(catalogs.credentialId, id), isNull(catalogs.deletedAt)))
    .limit(1)
  return !!row
}

export async function insert(input: {
  provider: Provider
  name: string
  config: ProviderConfig
  secret: string
}): Promise<ProviderCredential> {
  const [row] = await db.insert(providerCredentials).values(input).returning()
  return row
}

export async function update(
  id: string,
  set: Partial<{
    name: string
    config: ProviderConfig
    secret: string
    active: boolean
    lastSyncedAt: Date | null
  }>,
): Promise<ProviderCredential | null> {
  const [row] = await db
    .update(providerCredentials)
    .set({ ...set, updatedAt: new Date() })
    .where(
      and(eq(providerCredentials.id, id), isNull(providerCredentials.deletedAt)),
    )
    .returning()
  return row ?? null
}

export async function remove(id: string): Promise<void> {
  // Soft-delete: nunca se borra la fila (auditoría/trazabilidad); se marca
  // eliminada y se filtra de toda lectura. El guard de catálogos colgando ya no lo
  // da la FK (no hay DELETE real): se chequea en el service vía hasLinkedCatalogs.
  await db
    .update(providerCredentials)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(providerCredentials.id, id), isNull(providerCredentials.deletedAt)),
    )
}
