import type { Metadata } from "next"
import { FeatureExplorer } from "@/components/feature-explorer"
import { CtaBand } from "@/components/cta-band"

export const metadata: Metadata = {
  title: "Features",
  description:
    "Genos Mixer, Jam Player, bass and drum libraries, vocals, solos, Jam Session, and Cubase export.",
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
          <p className="prose-muted mt-4" style={{ maxWidth: "42rem" }}>
            Each screen is a real part of SmartBridge 1.0. Pick a feature on the left, read what
            it does, and see the screenshot from the app.
          </p>
          <FeatureExplorer />
        </div>
      </div>
      <CtaBand
        title="Want the full picture?"
        body="Download SmartBridge Setup or request beta access to try every module on your keyboard."
      />
    </>
  )
}
