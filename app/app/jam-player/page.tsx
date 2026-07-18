import type { Metadata } from "next"
import { PlaceholderWorkspace } from "@/components/app-shell/placeholder-workspace"
import { ServiceAccessGate } from "@/components/app-shell/service-access-gate"
import { SERVICE_CATALOG } from "@/components/app-shell/service-catalog"

const service = SERVICE_CATALOG["jam-player"]

export const metadata: Metadata = {
  title: service.name,
}

export default function JamPlayerAppPage() {
  return (
    <ServiceAccessGate serviceKey="jam-player">
      <PlaceholderWorkspace
        title={service.name}
        description={service.description}
      />
    </ServiceAccessGate>
  )
}
