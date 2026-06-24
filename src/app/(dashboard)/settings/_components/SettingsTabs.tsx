"use client"

import { usePathname } from "next/navigation"

import { TabNav } from "@/components/dashboard/TabNav"
import { siteConfig } from "@/app/siteConfig"

const base = siteConfig.baseLinks.settings

// Todas las secciones de Settings al mismo nivel, basadas en ruta. API keys vive
// en /settings; el resto cuelga de sub-rutas.
const TABS = [
  { key: "api", label: "API Keys", href: base },
  { key: "embed", label: "Embed", href: `${base}/embed` },
  { key: "maintenance", label: "Mantenimiento", href: `${base}/maintenance` },
  { key: "integrations", label: "Integraciones", href: siteConfig.baseLinks.integrations },
  { key: "webhooks", label: "Webhooks", href: siteConfig.baseLinks.webhooks },
]

export function SettingsTabs() {
  const pathname = usePathname()
  const active =
    TABS.slice(1).find((t) => pathname.startsWith(t.href))?.key ?? "api"

  return <TabNav active={active} tabs={TABS} />
}
