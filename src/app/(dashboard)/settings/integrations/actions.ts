"use server"

import { revalidatePath } from "next/cache"

import { requireUser } from "@/adapters/supabase/server"
import { type ActionResult, fail } from "@/lib/action-result"
import type { Provider } from "@/lib/db/schema"
import {
  availableProviders,
  createCredential as createCredentialSvc,
  deleteCredential as deleteCredentialSvc,
  renameCredential as renameCredentialSvc,
  rotateSecret as rotateSecretSvc,
  setCredentialActive as setCredentialActiveSvc,
  verifyCredential as verifyCredentialSvc,
  verifyDraft as verifyDraftSvc,
  type VerifyResult,
} from "@/modules/integrations"
import { ensureConfig, updateConfig as updatePartnerConfig } from "@/modules/partner-config"

// Habilita/deshabilita un proveedor "disponible" para el partner (nivel
// "disponible", partner_config.enabledProviders — definition sección 5). Solo se
// permiten proveedores que tienen adapter implementado.
export async function setProviderEnabled(
  provider: Provider,
  enabled: boolean,
): Promise<ActionResult> {
  await requireUser()
  try {
    if (!availableProviders().includes(provider)) {
      return { ok: false, error: `proveedor sin adapter: ${provider}` }
    }
    const cfg = await ensureConfig()
    const current = new Set(cfg.enabledProviders)
    if (enabled) current.add(provider)
    else current.delete(provider)
    await updatePartnerConfig({ ...cfg, enabledProviders: [...current] })
    revalidatePath("/settings/integrations")
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function verifyDraft(input: {
  provider: Provider
  config: unknown
  secret: string
}): Promise<VerifyResult> {
  await requireUser()
  try {
    return await verifyDraftSvc(input)
  } catch (err) {
    return fail(err)
  }
}

export async function verifyCredential(id: string): Promise<VerifyResult> {
  await requireUser()
  try {
    return await verifyCredentialSvc(id)
  } catch (err) {
    return fail(err)
  }
}

export async function createCredential(input: {
  provider: Provider
  name: string
  config: unknown
  secret: string
}): Promise<ActionResult<string>> {
  await requireUser()
  try {
    const cred = await createCredentialSvc(input)
    revalidatePath("/settings/integrations")
    return { ok: true, value: cred.id }
  } catch (err) {
    return fail(err)
  }
}

export async function renameCredential(
  id: string,
  name: string,
): Promise<ActionResult> {
  await requireUser()
  try {
    await renameCredentialSvc(id, name)
    revalidatePath("/settings/integrations")
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function rotateSecret(
  id: string,
  secret: string,
): Promise<ActionResult> {
  await requireUser()
  try {
    await rotateSecretSvc(id, secret)
    revalidatePath("/settings/integrations")
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function setCredentialActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireUser()
  try {
    await setCredentialActiveSvc(id, active)
    revalidatePath("/settings/integrations")
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteCredential(id: string): Promise<ActionResult> {
  await requireUser()
  try {
    await deleteCredentialSvc(id)
    revalidatePath("/settings/integrations")
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
