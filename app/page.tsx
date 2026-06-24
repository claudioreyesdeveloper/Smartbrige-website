import { Hero } from "@/components/hero"
import { WorkflowStrip } from "@/components/workflow-strip"
import { PillarCards } from "@/components/pillar-cards"
import { CompatibilityBar } from "@/components/compatibility-bar"
import { GalleryGrid } from "@/components/gallery-grid"
import { CtaBand } from "@/components/cta-band"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default function HomePage() {
  return (
    <>
      <Hero />
      <WorkflowStrip />
      <PillarCards />

      <section className="section-block">
        <div className="content-wrap">
          <div className="btn-row" style={{ justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1.5rem" }}>
            <div style={{ maxWidth: "42rem" }}>
              <p className="section-label">Modules</p>
              <h2 className="section-title" style={{ marginTop: "0.75rem" }}>Every tool in one song</h2>
              <p className="prose-muted" style={{ marginTop: "1rem" }}>
                Jam Player, ChordPro import, mixer control, bass and drum libraries, rhythm guitar,
                brass, vocals, lyrics, solos, and Jam Session — with fuller feature explanations and
                direct links into Claudio’s actual YouTube demos for each workflow.
              </p>
            </div>
            <Link href="/features" className="btn-secondary">
              Explore all features
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <CompatibilityBar />
      <GalleryGrid />
      <CtaBand />
    </>
  )
}
