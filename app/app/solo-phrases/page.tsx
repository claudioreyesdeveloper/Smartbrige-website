import type { Metadata } from "next"
import { PlaceholderWorkspace } from "@/components/app-shell/placeholder-workspace"
import { ServiceAccessGate } from "@/components/app-shell/service-access-gate"
import { SERVICE_CATALOG } from "@/components/app-shell/service-catalog"

const service = SERVICE_CATALOG["solo-phrases"]

export const metadata: Metadata = {
  title: service.name,
}

export default function SoloPhrasesAppPage() {
  return (
    <ServiceAccessGate serviceKey="solo-phrases">
      <PlaceholderWorkspace
        title={service.name}
        description={service.description}
      />
    </ServiceAccessGate>
  )
}
