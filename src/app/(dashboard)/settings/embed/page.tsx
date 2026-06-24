import { DEFAULT_CURRENCY_CODES } from "@/lib/products/currencies"
import { getConfig } from "@/modules/partner-config"

import { EmbedSettings } from "../_components/EmbedSettings"

export const dynamic = "force-dynamic"

export default async function EmbedSettingsPage() {
  const cfg = await getConfig()

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Embed
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monedas soportadas, orígenes permitidos y color de marca del iframe.
        </p>
      </div>

      <EmbedSettings
        currencies={
          cfg?.supportedCurrencies.length
            ? cfg.supportedCurrencies
            : DEFAULT_CURRENCY_CODES
        }
        allowedOrigins={cfg?.allowedOrigins ?? []}
        brandPrimary={cfg?.theme?.primary ?? null}
      />
    </main>
  )
}
