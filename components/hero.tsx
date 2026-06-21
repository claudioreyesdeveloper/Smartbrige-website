import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Play } from "lucide-react"
import { SITE } from "@/lib/site"

export function Hero() {
  return (
    <section className="gradient-hero section-block">
      <div className="content-wrap">
        <div className="hero-grid">
          <div>
            <p className="section-label" style={{ marginBottom: "1rem" }}>
              For Tyros · Genos · PSR-SX · Motif musicians
            </p>
            <h1 className="hero-title">From MIDI phrase to full arrangement</h1>
            <p className="prose-muted mt-5" style={{ fontSize: "1.125rem", maxWidth: "32rem" }}>
              SmartBridge connects your Yamaha keyboard to a complete songwriting workflow —
              chord-aware phrases, arrangement layers, vocals, lyrics, and DAW production in one
              environment.
            </p>
            <div className="btn-row mt-8">
              <Link href="/beta" className="btn-primary">
                Request beta access
                <ArrowRight size={16} />
              </Link>
              <a href={SITE.setupUrl} className="btn-secondary" target="_blank" rel="noopener noreferrer">
                Download Setup
              </a>
            </div>
            <p className="prose-muted mt-6" style={{ fontSize: "0.875rem" }}>
              macOS (Apple Silicon) · Windows x64 · VST3 + Standalone · Invitation-only beta
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
