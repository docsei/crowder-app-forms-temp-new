import { graceActiveUntil, listApiKeys } from "@/modules/api-keys"
import { getConfig } from "@/modules/partner-config"

import { SettingsForm } from "./_components/SettingsForm"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const [cfg, keys] = await Promise.all([getConfig(), listApiKeys()])

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          API keys de Crowder y monedas soportadas.
        </p>
      </div>

      <SettingsForm
        apiKeys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          secret: k.secret,
          active: k.active,
          createdAt: k.createdAt.toISOString(),
          graceUntil:
            graceActiveUntil(k.secretPreviousExpiresAt)?.toISOString() ?? null,
        }))}
        currencies={cfg?.supportedCurrencies ?? []}
        allowedOrigins={cfg?.allowedOrigins ?? []}
        brandPrimary={cfg?.theme?.primary ?? null}
      />
    </main>
  )
}
