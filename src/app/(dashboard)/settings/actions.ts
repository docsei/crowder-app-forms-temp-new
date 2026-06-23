"use server"

import { revalidatePath } from "next/cache"

import { requireUser } from "@/adapters/supabase/server"
import { parseOriginsList } from "@/lib/origins"
import { isValidHex } from "@/lib/theme"
import {
  createApiKey as createApiKeySvc,
  deleteApiKey as deleteApiKeySvc,
  regenerateApiKey as regenerateApiKeySvc,
  renameApiKey as renameApiKeySvc,
  setApiKeyActive as setApiKeyActiveSvc,
} from "@/modules/api-keys"
import { ensureConfig, updateConfig } from "@/modules/partner-config"
import { expireStale } from "@/modules/transactions"

export async function createApiKey(
  name: string,
): Promise<{ id: string; secret: string }> {
  await requireUser()
  const key = await createApiKeySvc(name)
  revalidatePath("/settings")
  return { id: key.id, secret: key.secret }
}

export async function regenerateApiKey(
  id: string,
): Promise<{ secret: string }> {
  await requireUser()
  const key = await regenerateApiKeySvc(id)
  revalidatePath("/settings")
  return { secret: key.secret }
}

export async function renameApiKey(id: string, name: string): Promise<void> {
  await requireUser()
  await renameApiKeySvc(id, name)
  revalidatePath("/settings")
}

export async function setApiKeyActive(
  id: string,
  active: boolean,
): Promise<void> {
  await requireUser()
  await setApiKeyActiveSvc(id, active)
  revalidatePath("/settings")
}

export async function deleteApiKey(id: string): Promise<void> {
  await requireUser()
  await deleteApiKeySvc(id)
  revalidatePath("/settings")
}

export async function updateCurrencies(currencies: string[]): Promise<void> {
  await requireUser()
  const current = await ensureConfig()
  await updateConfig({
    ...current,
    supportedCurrencies: currencies
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z]{3}$/.test(c)),
  })
  revalidatePath("/settings")
}

export async function updateBrandPrimary(hex: string | null): Promise<void> {
  await requireUser()
  const current = await ensureConfig()
  const next = hex?.trim() || null
  if (next && !isValidHex(next)) throw new Error("invalid hex color")
  await updateConfig({
    ...current,
    theme: next ? { primary: next } : null,
  })
  revalidatePath("/settings")
}

export async function updateAllowedOrigins(
  origins: string[],
): Promise<{ ok: boolean; error?: string }> {
  await requireUser()
  const current = await ensureConfig()
  const parsed = parseOriginsList(origins)
  if (!parsed.ok) return { ok: false, error: parsed.error }
  await updateConfig({ ...current, allowedOrigins: parsed.value })
  revalidatePath("/settings")
  return { ok: true }
}

export async function runExpireStale(): Promise<{ expired: number }> {
  await requireUser()
  const expired = await expireStale()
  revalidatePath("/transactions")
  return { expired }
}
