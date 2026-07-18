import type { Metadata } from "next"
import { ServiceAccessGate } from "@/components/app-shell/service-access-gate"
import { SERVICE_CATALOG } from "@/components/app-shell/service-catalog"
import { BassDrumsWorkspace } from "@/components/bass-drums/bass-drums-workspace"

const service = SERVICE_CATALOG["bass-drums"]

export const metadata: Metadata = {
  title: "Bass",
  description: service.description,
}

export default function JamPlayerBassPage() {
  return (
    <ServiceAccessGate serviceKey="bass-drums">
      <BassDrumsWorkspace initialTab="bass" partTabs="route" />
    </ServiceAccessGate>
  )
}
