import type { Metadata } from "next"
import { ServiceAccessGate } from "@/components/app-shell/service-access-gate"
import { SERVICE_CATALOG } from "@/components/app-shell/service-catalog"
import { SoloPhrasesFixtureEntry } from "@/components/solo-phrases/fixture-entry"

const service = SERVICE_CATALOG["solo-phrases"]

export const metadata: Metadata = {
  title: service.name,
}

export default function SoloPhrasesAppPage() {
  const testFixtureEnabled = process.env.SMARTBRIDGE_ACCESS_FIXTURE === "1"

  return (
    <ServiceAccessGate serviceKey="solo-phrases">
      {testFixtureEnabled ? (
        <SoloPhrasesFixtureEntry />
      ) : (
        <section className="solo-compatibility-stop" role="alert">
          <div>
            <span>Service connection required</span>
            <h2>Solo Phrases is not connected in this environment.</h2>
            <p>
              The first-release workspace requires an explicitly injected,
              display-safe service adapter.
            </p>
          </div>
        </section>
      )}
    </ServiceAccessGate>
  )
}
