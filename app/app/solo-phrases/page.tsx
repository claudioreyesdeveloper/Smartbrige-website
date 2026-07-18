import type { Metadata } from "next"
import { ServiceAccessGate } from "@/components/app-shell/service-access-gate"
import { SERVICE_CATALOG } from "@/components/app-shell/service-catalog"
import { SoloPhrasesFixtureEntry } from "@/components/solo-phrases/fixture-entry"
import { SoloPhrasesWorkspace } from "@/components/solo-phrases/solo-phrases-workspace"

const service = SERVICE_CATALOG["solo-phrases"]

export const metadata: Metadata = {
  title: service.name,
}

export default function SoloPhrasesAppPage() {
  const testFixtureEnabled = process.env.SMARTBRIDGE_UI_FIXTURE === "1"

  return (
    <ServiceAccessGate serviceKey="solo-phrases">
      {testFixtureEnabled ? (
        <SoloPhrasesFixtureEntry />
      ) : (
        <SoloPhrasesWorkspace />
      )}
    </ServiceAccessGate>
  )
}
