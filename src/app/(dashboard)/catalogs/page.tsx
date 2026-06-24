import { listCatalogs } from "@/modules/catalogs"
import { listCredentials } from "@/modules/integrations"
import { getConfig } from "@/modules/partner-config"

import { CatalogsManager } from "./_components/CatalogsManager"

export const dynamic = "force-dynamic"

export default async function CatalogsPage() {
  const [catalogs, creds, cfg] = await Promise.all([
    listCatalogs(),
    listCredentials(),
    getConfig(),
  ])

  return (
    <main>
      <CatalogsManager
        catalogs={catalogs.map((c) => ({
          id: c.id,
          title: c.title,
          source: c.source,
          currency: c.currency,
          lastSyncedAt: c.syncState?.lastRunAt ?? null,
        }))}
        credentials={creds
          .filter((c) => c.active)
          .map((c) => ({ id: c.id, name: c.name, provider: c.provider }))}
        supportedCurrencies={cfg?.supportedCurrencies ?? []}
      />
    </main>
  )
}
