import { DEFAULT_CURRENCY_CODES } from "@/lib/products/currencies"

import * as repo from "./repository"
import type { PartnerConfig } from "./repository"

// Si el partner no configuró monedas, asumimos las de LATAM (decisión de
// producto). El seed es solo lectura: no pisa una lista ya configurada y no
// reescribe la fila, así que un partner puede recortarla desde /settings.
function withDefaultCurrencies(cfg: PartnerConfig): PartnerConfig {
  if (cfg.supportedCurrencies.length > 0) return cfg
  return { ...cfg, supportedCurrencies: DEFAULT_CURRENCY_CODES }
}

export async function getConfig(): Promise<PartnerConfig | null> {
  const cfg = await repo.get()
  return cfg ? withDefaultCurrencies(cfg) : null
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
    supportedCurrencies: DEFAULT_CURRENCY_CODES,
    protocolVersions: ["1.2"],
    allowedOrigins: [],
    theme: null,
  })
}

export const updateConfig = repo.upsert
