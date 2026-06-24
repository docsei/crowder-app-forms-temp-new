import type { Provider } from "@/lib/db/schema"
import { availableProviders, listCredentials } from "@/modules/integrations"
import { getConfig } from "@/modules/partner-config"

import { IntegrationsManager } from "./_components/IntegrationsManager"

export const dynamic = "force-dynamic"

// Enmascara el secreto para la tabla sin exponer el token del tercero al cliente.
function maskSecret(secret: string): string {
  if (secret.length <= 8) return "••••"
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`
}

export default async function IntegrationsPage() {
  const [cfg, creds] = await Promise.all([getConfig(), listCredentials()])
  const enabledProviders: Provider[] = cfg?.enabledProviders ?? []
  const available: Provider[] = availableProviders()

  return (
    <main>
      <IntegrationsManager
        enabledProviders={enabledProviders}
        availableProviders={available}
        credentials={creds.map((c) => ({
          id: c.id,
          provider: c.provider,
          name: c.name,
          config: c.config,
          active: c.active,
          secretPreview: maskSecret(c.secret),
          lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </main>
  )
}
