import type { Metadata } from "next"
import { PlaceholderWorkspace } from "@/components/app-shell/placeholder-workspace"
import { SERVICE_CATALOG } from "@/components/app-shell/service-catalog"
import { mockEntitlementProvider } from "@/components/app-shell/mock-entitlement-provider"
import { UpgradeRequired } from "@/components/app-shell/upgrade-required"

const service = SERVICE_CATALOG.lyrics

export const metadata: Metadata = {
  title: service.name,
}

export default function LyricsAppPage() {
  if (!mockEntitlementProvider.isActive("lyrics")) {
    return <UpgradeRequired serviceKey="lyrics" />
  }

  return (
    <PlaceholderWorkspace
      title={service.name}
      description={service.description}
    />
  )
}
