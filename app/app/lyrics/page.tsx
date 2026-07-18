import type { Metadata } from "next"
import { PlaceholderWorkspace } from "@/components/app-shell/placeholder-workspace"
import { ServiceAccessGate } from "@/components/app-shell/service-access-gate"
import { SERVICE_CATALOG } from "@/components/app-shell/service-catalog"

const service = SERVICE_CATALOG.lyrics

export const metadata: Metadata = {
  title: service.name,
}

export default function LyricsAppPage() {
  return (
    <ServiceAccessGate serviceKey="lyrics">
      <PlaceholderWorkspace
        title={service.name}
        description={service.description}
      />
    </ServiceAccessGate>
  )
}
