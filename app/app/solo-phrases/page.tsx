import type { Metadata } from "next"
import { PlaceholderWorkspace } from "@/components/app-shell/placeholder-workspace"
import { SERVICE_CATALOG } from "@/components/app-shell/service-catalog"
import { mockEntitlementProvider } from "@/components/app-shell/mock-entitlement-provider"
import { UpgradeRequired } from "@/components/app-shell/upgrade-required"

const service = SERVICE_CATALOG["solo-phrases"]

export const metadata: Metadata = {
  title: service.name,
}

export default function SoloPhrasesAppPage() {
  if (!mockEntitlementProvider.isActive("solo-phrases")) {
    return <UpgradeRequired serviceKey="solo-phrases" />
  }

  return (
    <PlaceholderWorkspace
      title={service.name}
      description={service.description}
    />
  )
}
