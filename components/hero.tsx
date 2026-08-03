import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Download } from "lucide-react"
import { SITE } from "@/lib/site"

export function Hero() {
  return (
    <section className="m-hero m-hero-desktop">
      <div className="m-wrap m-hero-grid">
        <div className="m-hero-copy">
          <div className="m-kicker"><span className="m-kicker-dot" />Built for Yamaha musicians</div>
          <h1>Your whole musical workflow<span>from one screen.</span></h1>
          <p className="m-lead">
            SmartBridge Desktop connects your Genos, Tyros, or Motif to song building,
            performance libraries, vocals, solos, harmony, Cubase, and Synthesizer V.
            Style Maker brings focused Yamaha style creation to the browser.
          </p>
          <div className="m-actions">
            <Link href="/features" className="m-button m-button-primary">Explore SmartBridge Desktop <ArrowRight size={17} /></Link>
            <Link href="/style-maker" className="m-button m-button-quiet">Try Style Maker <ArrowRight size={17} /></Link>
          </div>
          <div className="m-hero-proof" aria-label="SmartBridge product availability">
            <span><CheckCircle2 size={16} /> Desktop for macOS + Windows</span>
            <span><CheckCircle2 size={16} /> Style Maker: 14-day trial</span>
            <span><Download size={16} /> Setup and beta access available</span>
          </div>
        </div>

        <div className="m-product-stage" aria-label="SmartBridge Desktop preview">
          <div className="m-stage-orbit m-stage-orbit-one" />
          <div className="m-stage-orbit m-stage-orbit-two" />
          <div className="m-product-window">
            <div className="m-window-bar"><span /><span /><span /><strong>SmartBridge Desktop · Jam Player</strong></div>
            <Image src="/images/desktop-v15/27_jam_player_song_chords.png" alt="SmartBridge Desktop Jam Player song and chord workflow" width={1280} height={853} priority />
          </div>
          <div className="m-floating-card m-floating-card-top"><span className="m-floating-icon">01</span><span><strong>Build the song</strong> Chords, key, tempo, form</span></div>
          <div className="m-floating-card m-floating-card-bottom"><span className="m-floating-icon">04</span><span><strong>Finish the idea</strong> Keyboard, Cubase, SynthV</span></div>
        </div>
      </div>
    </section>
  )
}
