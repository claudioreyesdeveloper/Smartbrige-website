import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  CheckCircle2,
  Download,
  Layers3,
  Music2,
  SlidersHorizontal,
} from "lucide-react"
import { SITE } from "@/lib/site"
import styles from "@/components/marketing-redesign.module.css"

export const metadata: Metadata = {
  title: "SmartBridge Desktop — Yamaha to finished production",
  description:
    "Keep the Yamaha, performed MIDI, Cubase, Synthesizer V, lyrics, solos, and harmony connected to one song from the first chord to the final editable production.",
}

const marketOutcomes = [
  {
    icon: SlidersHorizontal,
    label: "Preserve the rig",
    title: "Keep the Yamaha at the centre of the production.",
    body: "SmartBridge understands the real voices, channels, effects, styles, and Motif arpeggios rather than asking you to replace the hardware with a generic software instrument.",
  },
  {
    icon: Layers3,
    label: "Finish the arrangement",
    title: "Build complete sections from musical performances.",
    body: "Curated MIDI is auditioned against the song and adapted before export, so bass, guitar, drums, vocals, and solos arrive in Cubase as editable material that already belongs to the section.",
  },
  {
    icon: AudioLines,
    label: "Finish the melody",
    title: "Carry one melodic idea through lyrics, voices, brass, and strings.",
    body: "The same chord progression and form drives melody-fitted lyrics, Synthesizer V transfer, backing vocals, and four-part instrumental writing without reconstructing the song in every tool.",
  },
]

const capabilityGroups = [
  {
    image: "/images/desktop-v15/24_genos_mixer_v15.png",
    label: "Hardware and DAW coordination",
    title: "The computer reflects the real Yamaha setup.",
    body: "Select a keyboard voice and SmartBridge can rename the correct Cubase track automatically across all 32 Style and Song channels. The same environment also handles mixer state, DSP effects, ensemble presets, Motif parts, arpeggios, and native Yamaha style production.",
    features: ["32-channel Auto Renamer", "Genos and Tyros control", "Motif capture", "Native style export"],
  },
  {
    image: "/images/desktop-v15/38_piano_roll_editor.png",
    label: "Performance intelligence",
    title: "The MIDI follows the song and still sounds played.",
    body: "A large curated library is organised by musical purpose and adapted to the current section. Riff Extender develops short guitar ideas, while Solo Ornaments adds instrument-specific bends, trills, slides, falls, licks, swells, and approach gestures.",
    features: ["Curated performed MIDI", "Riff Extender", "Solo Ornaments", "MegaVoice-aware expression"],
  },
  {
    image: "/images/desktop-v15/35_vocals_daw_import.png",
    label: "Vocals and orchestration",
    title: "The melody becomes a finished arranged section.",
    body: "SmartBridge analyses the existing melody, fits singable words to its notes, handles syllables and melisma, and sends the result to Synthesizer V. The same song context creates humanised vocal stacks and range-aware brass or string parts.",
    features: ["Melody-to-Lyrics", "Synthesizer V handoff", "Vocal harmony", "Brass and strings"],
  },
]

const productionFlow = [
  ["01", "Define the song", "Load a progression, import ChordPro, or record your own sections in Jam Session."],
  ["02", "Connect the rig", "Read and control Yamaha voices, effects, styles, channels, Motif parts, and arpeggios."],
  ["03", "Build the section", "Audition chord-aware bass, drums, guitar, vocal, and solo material with the band."],
  ["04", "Develop the idea", "Extend riffs, add ornaments, fit lyrics, and create vocal, brass, or string parts."],
  ["05", "Finish in production", "Send correctly named tracks and editable MIDI to Cubase or completed vocals to Synthesizer V."],
]

const complements = [
  {
    icon: Music2,
    label: "Yamaha",
    title: "SmartBridge does not replace the keyboard.",
    body: "It makes the Yamaha easier to control, arrange around, document, and carry into production while preserving the sounds and performance behaviour you bought it for.",
  },
  {
    icon: SlidersHorizontal,
    label: "Cubase",
    title: "SmartBridge does not try to become the DAW.",
    body: "It prepares the song-aware, Yamaha-aware musical material that Cubase is best placed to edit, record, mix, and finish.",
  },
  {
    icon: AudioLines,
    label: "Synthesizer V",
    title: "SmartBridge works upstream from the vocal instrument.",
    body: "It creates the note-fitted lyrics and chord-aware vocal arrangement, then hands the completed parts to Synthesizer V for vocal rendering and detailed expression.",
  },
]

export default function FeaturesPage() {
  return (
    <div className={styles.desktopPage}>
      <section className={styles.desktopHero}>
        <div className={`m-wrap ${styles.desktopHeroGrid}`}>
          <div>
            <p className={styles.eyebrow}>SmartBridge Desktop · macOS + Windows</p>
            <h1 className={styles.desktopHeroTitle}>
              Keep the Yamaha idea connected
              <span>until the production is finished.</span>
            </h1>
            <p className={styles.sectionIntro} style={{ marginTop: "1.65rem" }}>
              SmartBridge Desktop carries one chord-aware song through Yamaha hardware, performed
              MIDI, Cubase, Synthesizer V, expressive solo development, lyrics, and orchestration.
              It removes the repeated setup between the musical idea and the final editable tracks.
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
              <span><CheckCircle2 size={15} /> Built around Genos, Tyros, PSR-SX, Motif, and Cubase workflows</span>
              <span><CheckCircle2 size={15} /> Chord-aware editable MIDI rather than fixed backing-track audio</span>
              <span><CheckCircle2 size={15} /> One song context for performances, lyrics, solos, and harmony</span>
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
            <p className={styles.eyebrow}>The customer outcome</p>
            <h2 className={styles.sectionTitle}>Less reconstruction. More completed music.</h2>
            <p className={styles.sectionIntro}>
              SmartBridge is designed around the breaks that appear when an arranger-keyboard idea
              has to become a structured, editable production on the computer.
            </p>
          </div>

          <div className={styles.enginesGrid}>
            {marketOutcomes.map((outcome) => (
              <article className={styles.engineCard} key={outcome.title}>
                <span className={styles.engineLabel}><outcome.icon size={15} /> {outcome.label}</span>
                <h3>{outcome.title}</h3>
                <p>{outcome.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.systemsSection}`}>
        <div className="m-wrap">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Three connected systems</p>
            <h2 className={styles.sectionTitle}>Coordinate the rig. Develop the performance. Finish the melody.</h2>
            <p className={styles.sectionIntro}>
              The capabilities are grouped around three jobs that carry the song forward: preserve
              the real Yamaha setup, create musical and expressive sections, and complete the vocal
              or instrumental arrangement.
            </p>
          </div>

          <div className={styles.harmoniesGrid}>
            {capabilityGroups.map((group) => (
              <article className={styles.harmonyCard} key={group.title}>
                <Image className={styles.harmonyImage} src={group.image} alt={`SmartBridge ${group.label}`} width={900} height={600} />
                <div className={styles.harmonyText}>
                  <span className={styles.engineLabel}>{group.label}</span>
                  <h3>{group.title}</h3>
                  <p>{group.body}</p>
                  <div className={styles.productPills}>{group.features.map((feature) => <span key={feature}>{feature}</span>)}</div>
                </div>
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

      <section className={styles.enginesSection}>
        <div className="m-wrap">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Designed to complement the studio</p>
            <h2 className={styles.sectionTitle}>SmartBridge connects the specialist tools instead of replacing them.</h2>
            <p className={styles.sectionIntro}>
              The Yamaha remains the performance instrument, Cubase remains the production centre,
              and Synthesizer V remains the vocal instrument. SmartBridge carries the musical intelligence between them.
            </p>
          </div>

          <div className={styles.enginesGrid}>
            {complements.map((item) => (
              <article className={styles.engineCard} key={item.title}>
                <span className={styles.engineLabel}><item.icon size={15} /> {item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.explorerSection}>
        <div className="content-wrap">
          <div className={styles.explorerIntro}>
            <p className="ux-section-label">Product reference</p>
            <h2>Need every screen, control, and workflow detail?</h2>
            <p>
              Open the interactive manual for exact information about keyboard control, songs,
              rhythm parts, vocals, solos, harmony, Motif, Cubase handoff, Jam Session, and Yamaha
              style creation.
            </p>
            <div className="m-actions" style={{ marginTop: "1.75rem" }}>
              <Link href="/manual" className="m-button m-button-primary">
                Open the Desktop manual <BookOpen size={17} />
              </Link>
              <Link href="/about" className="m-button m-button-outline-light">Why SmartBridge exists</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="m-final-cta">
        <div className="m-wrap m-final-cta-inner">
          <p className="m-eyebrow">SmartBridge Desktop</p>
          <h2>Move from the Yamaha performance to a finished, editable production without losing the song.</h2>
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
