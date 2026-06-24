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
          <p className="section-label">Product</p>
          <h1 className="section-title" style={{ marginTop: "0.75rem" }}>
            Everything in SmartBridge
          </h1>
          <p className="prose-muted mt-4" style={{ maxWidth: "48rem" }}>
            Each screen below is a real part of SmartBridge. Pick a feature on the left, read what
            it does, and jump straight to Claudio’s walkthroughs for the matching workflow.
          </p>
          <FeatureExplorer />
        </div>
      </div>
      <VideoGuideGrid />
      <CtaBand
        title="Want the full picture?"
        body="Download SmartBridge Setup or request beta access to try every module on your keyboard."
      />
    </>
  )
}
