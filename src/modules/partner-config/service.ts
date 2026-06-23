import { DomainError } from "@/lib/errors"

import * as repo from "./repository"
import type { PartnerConfig } from "./repository"

export async function getConfig(): Promise<PartnerConfig | null> {
  return repo.get()
}

export async function requireConfig(): Promise<PartnerConfig> {
  const cfg = await repo.get()
  if (!cfg) {
    throw new DomainError(
      "internal_error",
      "partner_config is not initialized — visit /settings",
    )
  }
  return cfg
}

/**
 * Devuelve la config, creándola con defaults si todavía no existe. Antes la
 * fila se materializaba recién al generar la API key; ahora las keys viven en
 * su propia tabla, así que la config se inicializa de forma independiente.
 */
export async function ensureConfig(): Promise<PartnerConfig> {
  const cfg = await repo.get()
  if (cfg) return cfg
  return repo.upsert({
    supportedCurrencies: [],
    protocolVersions: ["1.2"],
    allowedOrigins: [],
    theme: null,
  })
}

export const updateConfig = repo.upsert
