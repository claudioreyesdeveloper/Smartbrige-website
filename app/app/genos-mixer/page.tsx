import type { Metadata } from "next"
import { ServiceAccessGate } from "@/components/app-shell/service-access-gate"
import { SERVICE_CATALOG } from "@/components/app-shell/service-catalog"
import { GenosMixerWorkspace } from "@/components/genos-mixer/genos-mixer-workspace"

const service = SERVICE_CATALOG["genos-mixer"]

export const metadata: Metadata = {
  title: service.name,
}

export default function GenosMixerAppPage() {
  return (
    <ServiceAccessGate serviceKey="genos-mixer">
      <GenosMixerWorkspace />
    </ServiceAccessGate>
  )
}
