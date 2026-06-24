import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { partnerConfig, type PartnerTheme, type Provider } from "@/lib/db/schema"

export type { PartnerTheme }

export type PartnerConfig = {
  id: number
  supportedCurrencies: string[]
  protocolVersions: string[]
  allowedOrigins: string[]
  theme: PartnerTheme | null
  enabledProviders: Provider[]
  updatedAt: Date
}

export async function get(): Promise<PartnerConfig | null> {
  const [row] = await db
    .select()
    .from(partnerConfig)
    .where(eq(partnerConfig.id, 1))
    .limit(1)
  return (row as PartnerConfig | undefined) ?? null
}

export async function upsert(input: {
  supportedCurrencies: string[]
  protocolVersions: string[]
  allowedOrigins?: string[]
  theme?: PartnerTheme | null
  enabledProviders?: Provider[]
}): Promise<PartnerConfig> {
  const [row] = await db
    .insert(partnerConfig)
    .values({ id: 1, ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: partnerConfig.id,
      set: { ...input, updatedAt: new Date() },
    })
    .returning()
  return row as PartnerConfig
}
