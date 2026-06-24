// Registro de monedas soportadas. El `code` ISO 4217 es lo que se guarda en
// products.currency / catalogs.currency y viaja en el protocolo Crowder
// (context.currency); el `symbol` es lo único que ve el fan en el iframe.
// Las que comparten "$" se desambiguan por país (AR$, CLP$, COL$, MX$, US$)
// para no confundir pesos entre países (decisión de producto).

export type CurrencyDef = {
  code: string // ISO 4217 — fuente de verdad
  symbol: string // lo que se muestra al fan
  name: string // nombre legible (settings)
  country: string
  decimals: number // dígitos decimales al formatear
  locale: string // locale para separadores de miles/decimales (Intl)
}

export const CURRENCIES: Record<string, CurrencyDef> = {
  ARS: { code: "ARS", symbol: "AR$", name: "Peso argentino", country: "Argentina", decimals: 2, locale: "es-AR" },
  CLP: { code: "CLP", symbol: "CLP$", name: "Peso chileno", country: "Chile", decimals: 0, locale: "es-CL" },
  BRL: { code: "BRL", symbol: "R$", name: "Real", country: "Brasil", decimals: 2, locale: "pt-BR" },
  PEN: { code: "PEN", symbol: "S/", name: "Sol", country: "Perú", decimals: 2, locale: "es-PE" },
  COP: { code: "COP", symbol: "COL$", name: "Peso colombiano", country: "Colombia", decimals: 0, locale: "es-CO" },
  MXN: { code: "MXN", symbol: "MX$", name: "Peso mexicano", country: "México", decimals: 2, locale: "es-MX" },
  USD: { code: "USD", symbol: "US$", name: "Dólar estadounidense", country: "EE. UU.", decimals: 2, locale: "en-US" },
}

// Monedas LATAM sembradas por defecto cuando el partner no configuró ninguna.
export const DEFAULT_CURRENCY_CODES = ["ARS", "CLP", "BRL", "PEN", "COP", "MXN", "USD"]

export const CURRENCY_LIST: CurrencyDef[] = DEFAULT_CURRENCY_CODES.map((c) => CURRENCIES[c])

export function getCurrency(code: string | null | undefined): CurrencyDef | null {
  if (!code) return null
  return CURRENCIES[code.toUpperCase()] ?? null
}

// Etiqueta para selectores del dashboard: "Perú — S/ (PEN)". Códigos fuera del
// registro caen al código pelado.
export function currencyLabel(code: string): string {
  const def = getCurrency(code)
  return def ? `${def.country} — ${def.symbol} (${def.code})` : code
}
