import { graceActiveUntil, listApiKeys } from "@/modules/api-keys"

import { ApiKeysManager } from "./_components/ApiKeysManager"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const keys = await listApiKeys()

  return (
    <main>
      <ApiKeysManager
        apiKeys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          secret: k.secret,
          active: k.active,
          createdAt: k.createdAt.toISOString(),
          graceUntil:
            graceActiveUntil(k.secretPreviousExpiresAt)?.toISOString() ?? null,
        }))}
      />
    </main>
  )
}
