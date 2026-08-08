import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  AudioLines,
  CheckCircle2,
  Download,
  Layers3,
  Music2,
  Repeat2,
  SlidersHorizontal,
  WandSparkles,
} from "lucide-react"
import { FeatureExplorer } from "@/components/feature-explorer"
import { SITE } from "@/lib/site"
import styles from "@/components/marketing-redesign.module.css"

export const metadata: Metadata = {
  title: "SmartBridge Desktop — Chord-aware Yamaha production system",
  description:
    "One connected song context for Yamaha hardware, Cubase track naming, chord-aware performance libraries, Riff Extender, Solo Ornaments, melody-fitted lyrics, Synthesizer V, and four-part harmony.",
}

const engines = [
  {
    icon: SlidersHorizontal,
    label: "Keyboard → Cubase",
    title: "All 32 tracks stay correctly named.",
    body: "Choose voices on Genos or Tyros and SmartBridge updates the corresponding Cubase track names through MIDI Remote. The DAW reflects the actual keyboard state without manual bank-number decoding.",
  },
  {
    icon: Layers3,
    label: "Curated MIDI",
    title: "Played performances follow the real progression.",
    body: "Bass, drums, guitar, vocals, and solos are selected for their musical function, auditioned with the band, and adapted to the current JamPlayer section before export.",
  },
  {
    icon: Repeat2,
    label: "Riff Extender",
    title: "Develop the riff instead of looping it.",
    body: "Give SmartBridge a one- or two-bar rock, pop, or funk guitar idea and extend it through the remaining bars while preserving its identity and following every chord change.",
  },
  {
    icon: WandSparkles,
    label: "Solo Ornaments",
    title: "Add the gestures that make the instrument believable.",
    body: "Place trills, bends, slides, falls, pickups, licks, swells, and approach notes with instrument range, timing, pitch bend, and the underlying harmony in view.",
  },
  {
    icon: AudioLines,
    label: "Melody → Lyrics → SynthV",
    title: "The words are composed for the melody.",
    body: "SmartBridge analyses note duration and phrasing, fits syllables and melisma, shapes hooks and repeats, then transfers the completed vocal to Synthesizer V at the correct playhead position.",
  },
  {
    icon: Music2,
    label: "Harmony engines",
    title: "One melody becomes a complete section.",
    body: "Use the JamPlayer progression to create humanised backing vocals, range-aware four-part brass, or practical violin, viola, and cello writing—with every voice available as editable MIDI.",
  },
]

const productionFlow = [
  ["01", "Define the song", "Load a progression, import ChordPro, or record your own sections in Jam Session."],
  ["02", "Connect the rig", "Read and control Yamaha voices, effects, styles, channels, Motif parts, and arpeggios."],
  ["03", "Build performances", "Audition chord-aware bass, drums, guitar, vocal, and solo material against the band."],
  ["04", "Develop the arrangement", "Extend riffs, add ornaments, fit lyrics, and create vocal, brass, or string parts."],
  ["05", "Move into production", "Send correctly named tracks and editable MIDI to Cubase or a finished vocal to Synthesizer V."],
]

export default function FeaturesPage() {
  return (
    <div className={styles.desktopPage}>
      <section className={styles.desktopHero}>
        <div className={`m-wrap ${styles.desktopHeroGrid}`}>
          <div>
            <p className={styles.eyebrow}>SmartBridge Desktop · macOS + Windows</p>
            <h1 className={styles.desktopHeroTitle}>
              From the first chord
              <span>to the finished production.</span>
            </h1>
            <p className={styles.sectionIntro} style={{ marginTop: "1.65rem" }}>
              SmartBridge Desktop is one connected musical system for Yamaha hardware, Cubase,
              Synthesizer V, curated performed MIDI, expressive solo development, lyrics, and
              orchestration. Every tool reads the same song instead of asking you to rebuild it.
            </p>
            <div className="m-actions" style={{ marginTop: "2rem" }}>
              <a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer" className="m-button m-button-primary">
                Download SmartBridge Setup <Download size={17} />
              </a>
              <Link href="/beta" className="m-button m-button-outline-light">
                Request beta access <ArrowRight size={17} />
              </Link>
            </div>
            <div className={styles.desktopHeroProof}>
              <span><CheckCircle2 size={15} /> 32 Yamaha Style and Song channels connected to Cubase</span>
              <span><CheckCircle2 size={15} /> Chord-aware, editable MIDI—not fixed audio backing tracks</span>
              <span><CheckCircle2 size={15} /> Direct Yamaha, Cubase, Motif, and Synthesizer V workflows</span>
            </div>
          </div>

          <div className={styles.desktopHeroWindow}>
            <div className={styles.windowBar}><i /><i /><i /><strong>SmartBridge Desktop · Solo Ideas</strong></div>
            <Image
              src="/images/desktop-v15/37_solo_ideas.png"
              alt="SmartBridge Desktop developing a chord-aware instrumental solo"
              width={1200}
              height={800}
              priority
            />
          </div>
        </div>
      </section>

      <section className={styles.enginesSection}>
        <div className="m-wrap">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>The signature engines</p>
            <h2 className={styles.sectionTitle}>The power is in the connection.</h2>
            <p className={styles.sectionIntro}>
              A phrase generator, chord tool, or harmonizer solves only one moment. SmartBridge
              connects the physical Yamaha, the complete song, expressive MIDI, Cubase, and vocal
              production in one continuous workflow.
            </p>
          </div>

          <div className={styles.enginesGrid}>
            {engines.map((engine) => (
              <article className={styles.engineCard} key={engine.title}>
                <span className={styles.engineLabel}><engine.icon size={15} /> {engine.label}</span>
                <h3>{engine.title}</h3>
                <p>{engine.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.flowSection}>
        <div className="m-wrap">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>One continuous production flow</p>
            <h2 className={styles.sectionTitle}>The song does not disappear between tools.</h2>
            <p className={styles.sectionIntro}>
              The chord progression, sections, key, tempo, and musical intent remain available from
              the first keyboard idea through the final editable tracks.
            </p>
          </div>

          <div className={styles.flowGrid}>
            {productionFlow.map(([index, title, body]) => (
              <article className={styles.flowStep} key={title}>
                <span className={styles.flowIndex}>{index}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.explorerSection}>
        <div className="content-wrap">
          <div className={styles.explorerIntro}>
            <p className="ux-section-label">SmartBridge Desktop v1.5</p>
            <h2>Explore the complete control room.</h2>
            <p>
              The interactive manual below covers the current connected tools for keyboard control,
              songs, rhythm section, vocals, solos, harmony, Motif, Cubase handoff, Jam Session, and
              native Yamaha style creation.
            </p>
          </div>
          <FeatureExplorer />
        </div>
      </section>

      <section className="m-final-cta">
        <div className="m-wrap m-final-cta-inner">
          <p className="m-eyebrow">SmartBridge Desktop</p>
          <h2>One song context across the Yamaha, the performances, Cubase, and Synthesizer V.</h2>
          <div className="m-actions">
            <a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer" className="m-button m-button-primary">
              Download Setup <Download size={17} />
            </a>
            <Link href="/beta" className="m-button m-button-outline-light">Request beta access</Link>
            <Link href="/style-maker" className="m-button m-button-outline-light">Explore Style Maker</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
