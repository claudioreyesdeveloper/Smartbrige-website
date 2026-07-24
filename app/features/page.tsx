import type { Metadata } from "next"
import { FeatureExplorer } from "@/components/feature-explorer"
import { VideoGuideGrid } from "@/components/video-guide-grid"
import { CtaBand } from "@/components/cta-band"

export const metadata: Metadata = {
  title: "Features",
  description:
    "Genos Mixer, Jam Player, ChordPro import, bass and drum libraries, vocals, lyrics, solos, Jam Session, and linked SmartBridge demo videos.",
}

export default function FeaturesPage() {
  return (
    <>
      <div className="page-shell">
        <div className="content-wrap">
          <p className="ux-section-label">Product</p>
          <h1 className="section-title" style={{ marginTop: "0.85rem" }}>
            Everything in SmartBridge
          </h1>
          <p className="prose-muted mt-4" style={{ maxWidth: "42rem", lineHeight: 1.55 }}>
            Pick a module on the left. Get one clear explanation of what it does, why it matters
            in the song, and which demo video shows it live.
          </p>
          <FeatureExplorer />
        </div>
      </div>
      <VideoGuideGrid />
      <CtaBand
        title="Try Style Maker now — or the full desktop beta"
        body="Style Maker is available today with a 14-day free trial. For Jam Player, vocals, and the full suite, download Setup or request beta access."
      />
    </>
  )
}
