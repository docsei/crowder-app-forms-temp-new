import { and, desc, eq, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { apiKeys } from "@/lib/db/schema"

export type ApiKey = {
  id: string
  name: string
  secret: string
  secretPrevious: string | null
  secretPreviousExpiresAt: Date | null
  active: boolean
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export async function list(): Promise<ApiKey[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(isNull(apiKeys.deletedAt))
    .orderBy(desc(apiKeys.createdAt))
  return rows as ApiKey[]
}

export async function listActive(): Promise<ApiKey[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.active, true), isNull(apiKeys.deletedAt)))
  return rows as ApiKey[]
}

export async function get(id: string): Promise<ApiKey | null> {
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.deletedAt)))
    .limit(1)
  return (row as ApiKey | undefined) ?? null
}

export async function insert(input: {
  name: string
  secret: string
}): Promise<ApiKey> {
  const [row] = await db
    .insert(apiKeys)
    .values({ name: input.name, secret: input.secret })
    .returning()
  return row as ApiKey
}

export async function update(
  id: string,
  set: Partial<{
    name: string
    secret: string
    secretPrevious: string | null
    secretPreviousExpiresAt: Date | null
    active: boolean
    deletedAt: Date | null
  }>,
): Promise<ApiKey | null> {
  const [row] = await db
    .update(apiKeys)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(apiKeys.id, id))
    .returning()
  return (row as ApiKey | undefined) ?? null
}

export async function remove(id: string): Promise<void> {
  // Soft-delete: marcamos la fila como eliminada en lugar de borrarla, así
  // queda registro y deja de aparecer/autenticar (las lecturas filtran deletedAt).
  await db
    .update(apiKeys)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.deletedAt)))
}
