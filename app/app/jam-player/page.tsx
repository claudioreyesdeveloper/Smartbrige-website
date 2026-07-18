import type { Metadata } from "next"
import { JamPlayerWorkspace } from "@/components/jam-player"
import { ServiceAccessGate } from "@/components/app-shell/service-access-gate"
import { SERVICE_CATALOG } from "@/components/app-shell/service-catalog"

const service = SERVICE_CATALOG["jam-player"]

export const metadata: Metadata = {
  title: service.name,
}

export default function JamPlayerAppPage() {
  return (
    <ServiceAccessGate serviceKey="jam-player">
      <JamPlayerWorkspace />
    </ServiceAccessGate>
  )
}
