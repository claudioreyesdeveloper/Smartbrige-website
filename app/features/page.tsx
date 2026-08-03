import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Cable, Download, Layers3, SlidersHorizontal, WandSparkles } from "lucide-react"
import { FeatureExplorer } from "@/components/feature-explorer"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "SmartBridge Desktop",
  description: "The complete SmartBridge Desktop workflow for Genos, Tyros, Motif, Cubase, Synthesizer V, song building, performances, vocals, solos, and Yamaha styles.",
}

const workflow = [
  { icon: SlidersHorizontal, title: "Control the keyboard", body: "Mix Genos and Motif parts, voices, effects, ensembles, arps, and saved setups from the computer." },
  { icon: Layers3, title: "Build the arrangement", body: "Load or import the song, follow its chord grid, then place played rhythm-section parts into every section." },
  { icon: WandSparkles, title: "Create the missing parts", body: "Write vocal melodies, lyrics, solos, brass and string harmony with the song’s chords always in view." },
  { icon: Cable, title: "Move into production", body: "Drag editable MIDI to Cubase, send the vocal to Synthesizer V, or transfer native styles to the keyboard." },
]

export default function FeaturesPage() {
  return (
    <div className="desktop-lab-page desktop-product-page">
      <section className="desktop-lab-hero desktop-product-hero">
        <div className="m-wrap desktop-product-hero-grid">
          <div>
            <p className="m-eyebrow">SmartBridge Desktop · macOS + Windows</p>
            <h1>The complete Yamaha-to-production workflow.</h1>
            <p>
              SmartBridge Desktop is the musical control room: control Genos, Tyros, and Motif;
              build songs from chord grids; add real performances, vocals, lyrics, solos, and
              harmony; then move the result into Cubase, Synthesizer V, or back to the keyboard.
            </p>
            <div className="m-actions">
              <a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer" className="m-button m-button-primary">Download SmartBridge Setup <Download size={17} /></a>
              <Link href="/beta" className="m-button m-button-outline-light">Request beta access <ArrowRight size={17} /></Link>
            </div>
            <p className="desktop-product-note">VST3 + Standalone · Apple Silicon + Windows x64 · Invitation-only beta activation</p>
          </div>
          <div className="desktop-product-shot">
            <div className="m-window-bar"><span /><span /><span /><strong>SmartBridge Desktop v1.5</strong></div>
            <Image src="/images/desktop-v15/27_jam_player_song_chords.png" alt="SmartBridge Desktop song and chord grid" width={1100} height={733} priority />
          </div>
        </div>
      </section>

      <section className="desktop-product-workflow">
        <div className="m-wrap">
          <div className="desktop-product-workflow-head"><p className="m-eyebrow">One connected song model</p><h2>Every tool knows what the song is doing.</h2><p>Choose the song, section, key, and tempo once. That context follows you from the keyboard mix to the rhythm section, vocal, solo, harmony, and DAW.</p></div>
          <div className="desktop-product-workflow-grid">{workflow.map((item, index) => <article key={item.title}><span>0{index + 1}</span><item.icon size={21} /><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
        </div>
      </section>

      <section className="desktop-lab-explorer desktop-product-explorer">
        <div className="content-wrap">
          <div className="desktop-lab-intro"><p className="m-eyebrow">Desktop v1.5 features</p><h2>Explore the complete control room.</h2><p>Every screen and description below comes from the current SmartBridge Desktop interactive manual.</p></div>
          <FeatureExplorer />
        </div>
      </section>

      <section className="m-final-cta">
        <div className="m-wrap m-final-cta-inner">
          <p className="m-eyebrow">SmartBridge Desktop</p>
          <h2>From the first chord to the finished production sketch.</h2>
          <div className="m-actions"><a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer" className="m-button m-button-primary">Download Setup <Download size={17} /></a><Link href="/beta" className="m-button m-button-outline-light">Request beta access</Link></div>
        </div>
      </section>
    </div>
  )
}
