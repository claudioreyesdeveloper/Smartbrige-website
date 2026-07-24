import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SITE } from "@/lib/site"

export function Hero() {
  return (
    <section className="gradient-hero section-block">
      <div className="content-wrap">
        <div className="hero-grid">
          <div>
            <p className="ux-section-label" style={{ marginBottom: "1.15rem" }}>
              For Tyros · Genos · PSR-SX · Motif musicians
            </p>
            <h1 className="hero-title">From MIDI phrase to full arrangement</h1>
            <p className="prose-muted mt-6" style={{ fontSize: "1.2rem", maxWidth: "32rem", lineHeight: 1.6 }}>
              Connect your Yamaha keyboard to a songwriting workflow — chord-aware phrases,
              arrangement layers, vocals, and DAW production in one place.
            </p>
            <div className="btn-row mt-9" style={{ gap: "0.9rem" }}>
              <Link href="/style-maker" className="btn-primary" style={{ minHeight: "3rem", padding: "0.85rem 1.35rem" }}>
                Start Style Maker free trial
                <ArrowRight size={16} />
              </Link>
              <a
                href={SITE.setupUrl}
                className="btn-secondary"
                style={{ minHeight: "3rem", padding: "0.85rem 1.35rem" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download Setup
              </a>
              <Link href="/beta" className="btn-secondary" style={{ minHeight: "3rem", padding: "0.85rem 1.35rem" }}>
                Request beta access
              </Link>
            </div>
            <p className="prose-muted mt-6" style={{ fontSize: "0.875rem" }}>
              Style Maker is available now (14-day free trial). Full desktop SmartBridge is
              invitation-only beta · macOS Apple Silicon · Windows x64 · VST3 + Standalone
            </p>
          </div>

          <div className="hero-shot">
            <div className="card-surface" style={{ overflow: "hidden" }}>
              <Image
                src="/images/jam-player-tyros.png"
                alt="SmartBridge Jam Player — chord progression grid"
                width={1200}
                height={750}
                style={{ width: "100%", objectFit: "cover" }}
                priority
              />
            </div>
            <div className="hero-shot-glow" />
          </div>
        </div>
      </div>
    </section>
  )
}
