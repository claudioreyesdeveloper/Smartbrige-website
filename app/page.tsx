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
            <div style={{ maxWidth: "40rem" }}>
              <p className="ux-section-label">Modules</p>
              <h2 className="section-title" style={{ marginTop: "0.85rem" }}>
                One workflow, every layer
              </h2>
              <p className="prose-muted" style={{ marginTop: "1rem", lineHeight: 1.55 }}>
                Jam Player, Style Maker, mixer control, bass and drum libraries, vocals, lyrics, and
                solos — each explained with real demo videos, not feature dump lists.
              </p>
            </div>
            <Link href="/features" className="btn-secondary" style={{ minHeight: "2.75rem" }}>
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
