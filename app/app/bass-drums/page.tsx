import type { Metadata } from "next"
import { PlaceholderWorkspace } from "@/components/app-shell/placeholder-workspace"
import { SERVICE_CATALOG } from "@/components/app-shell/service-catalog"
import { mockEntitlementProvider } from "@/components/app-shell/mock-entitlement-provider"
import { UpgradeRequired } from "@/components/app-shell/upgrade-required"

const service = SERVICE_CATALOG["bass-drums"]

export const metadata: Metadata = {
  title: service.name,
}

export default function BassDrumsAppPage() {
  if (!mockEntitlementProvider.isActive("bass-drums")) {
    return <UpgradeRequired serviceKey="bass-drums" />
  }

  return (
    <PlaceholderWorkspace
      title={service.name}
      description={service.description}
    />
  )
}
