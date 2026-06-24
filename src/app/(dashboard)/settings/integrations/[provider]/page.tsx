import { notFound } from "next/navigation"

import type { Provider } from "@/lib/db/schema"
import { availableProviders, listCredentials } from "@/modules/integrations"
import { getConfig } from "@/modules/partner-config"

import { ProviderDetail } from "./_components/ProviderDetail"

export const dynamic = "force-dynamic"

// Enmascara el secreto para la UI sin exponer el token del tercero al cliente.
function maskSecret(secret: string): string {
  if (secret.length <= 8) return "••••"
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`
}

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ provider: string }>
}) {
  const { provider } = await params

  // Solo proveedores con adapter implementado.
  if (!availableProviders().includes(provider as Provider)) notFound()
  const p = provider as Provider

  const [cfg, creds] = await Promise.all([getConfig(), listCredentials()])
  // La integración tiene que estar habilitada para tener página de detalle.
  if (!(cfg?.enabledProviders ?? []).includes(p)) notFound()

  return (
    <main>
      <ProviderDetail
        provider={p}
        credentials={creds
          .filter((c) => c.provider === p)
          .map((c) => ({
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
