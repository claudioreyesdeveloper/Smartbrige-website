import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, HeartHandshake, Music2, Wrench } from "lucide-react"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Why SmartBridge exists",
  description: "Meet Claudio Reyes and the musician-led idea behind one connected Yamaha, Cubase, and Synthesizer V production workflow.",
}

export default function AboutPage() {
  return (
    <div className="marketing-page mp-page editorial-page">
      <section className="editorial-hero">
        <div className="m-wrap editorial-hero-grid">
          <div>
            <p className="m-eyebrow">Why SmartBridge exists</p>
            <h1>The song should not disappear every time you open another tool.</h1>
            <p>
              SmartBridge is an independent music-software project by Claudio Reyes—a Yamaha
              keyboard musician who wanted the arranger, the performed MIDI, Cubase, and the vocal
              workflow to understand the same song.
            </p>
          </div>
          <div className="editorial-portrait">
            <Image src="/images/claudio-reyes-studio.jpg" alt="Claudio Reyes working in his music studio" width={900} height={1200} priority />
            <span>Claudio Reyes · Musician and creator of SmartBridge</span>
          </div>
        </div>
      </section>

      <section className="m-section editorial-story">
        <div className="m-wrap editorial-story-grid">
          <p className="m-eyebrow">The original problem</p>
          <div>
            <h2>The Yamaha was inspiring. The production chain around it was fragmented.</h2>
            <p>
              A musical idea could begin quickly on the keyboard, but the context did not travel.
              Voice names had to be reconstructed in Cubase. MIDI phrases had to be searched,
              transposed, and repaired. Lyrics, backing voices, brass, and strings each required a
              separate reconstruction of the same chord progression.
            </p>
            <p>
              SmartBridge began by connecting the real rig: Yamaha voices, channels, effects,
              styles, Motif arpeggios, and Cubase. It then grew around one architectural rule—the
              chords, sections, key, and tempo should be defined once and understood everywhere.
            </p>
            <p>
              That shared song now drives a curated performance library, Cubase track naming, Riff
              Extender, Solo Ornaments, melody-fitted lyrics, Synthesizer V transfer, and separate
              vocal, brass, and string harmony engines.
            </p>
          </div>
        </div>
      </section>

      <section className="m-section editorial-values">
        <div className="m-wrap">
          <div className="m-section-heading"><p className="m-eyebrow">The way it is built</p><h2>Musical context before isolated features.</h2></div>
          <div className="editorial-value-grid">
            {[
              { icon: Music2, title: "The song is the source of truth", body: "Every performance, ornament, lyric, harmony, and export is judged against the actual section and chord progression—not generated in isolation." },
              { icon: Wrench, title: "Built for the awkward real details", body: "MegaVoice velocity layers, bank and program data, pitch bends, Yamaha style structure, USB MIDI, Cubase track mapping, and hardware state are part of the product—not edge cases." },
              { icon: HeartHandshake, title: "Independent and direct", body: "SmartBridge is developed by the musician who uses it. Questions, compatibility problems, and musical feedback reach the person making the product decisions." },
            ].map((value) => (
              <article key={value.title}><value.icon size={23} /><h3>{value.title}</h3><p>{value.body}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="m-final-cta">
        <div className="m-wrap m-final-cta-inner">
          <p className="m-eyebrow">Built around real Yamaha workflows</p>
          <h2>Have a song-production problem SmartBridge should understand?</h2>
          <div className="m-actions">
            <a href={`mailto:${SITE.email}`} className="m-button m-button-primary">Email Claudio <ArrowRight size={17} /></a>
            <Link href="/features" className="m-button m-button-outline-light">Explore Desktop</Link>
            <Link href="/style-maker" className="m-button m-button-outline-light">Explore Style Maker</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
