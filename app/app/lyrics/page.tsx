import type { Metadata } from "next"
import { ServiceAccessGate } from "@/components/app-shell/service-access-gate"
import { SERVICE_CATALOG } from "@/components/app-shell/service-catalog"
import { LyricsFixtureEntry } from "@/components/lyrics/fixture-entry"
import { LyricsWorkspace } from "@/components/lyrics/lyrics-workspace"

const service = SERVICE_CATALOG.lyrics

export const metadata: Metadata = {
  title: service.name,
}

export default function LyricsAppPage() {
  const fixtureEnabled = process.env.SMARTBRIDGE_UI_FIXTURE === "1"

  return (
    <ServiceAccessGate serviceKey="lyrics">
      {fixtureEnabled ? <LyricsFixtureEntry /> : <LyricsWorkspace />}
    </ServiceAccessGate>
  )
}
