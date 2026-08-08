import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  AudioLines,
  Cable,
  Layers3,
  Music2,
  Repeat2,
  SlidersHorizontal,
  WandSparkles,
} from "lucide-react"
import { Hero } from "@/components/hero"
import { SITE } from "@/lib/site"
import styles from "@/components/marketing-redesign.module.css"

const marketProblems = [
  {
    icon: Cable,
    label: "The disconnected rig",
    title: "The Yamaha and the DAW stop understanding each other.",
    body: "The idea begins on the keyboard, but voice names, channel assignments, effects, chord context, and arrangement decisions have to be reconstructed once the project reaches the computer.",
  },
  {
    icon: Layers3,
    label: "The generic-loop problem",
    title: "Most MIDI content does not know the song it is entering.",
    body: "A useful bass line, guitar riff, or solo phrase still needs to be searched, transposed, repaired, and reshaped for the actual verse or chorus before it becomes part of the arrangement.",
  },
  {
    icon: AudioLines,
    label: "The unfinished melody",
    title: "Lyrics, backing voices, brass, and strings restart the same work.",
    body: "The melody may already exist, but every finishing tool asks for the harmony, form, phrasing, and timing again. The musical context disappears between applications.",
  },
]

const connectedOutputs = [
  ["01", "Yamaha and Cubase", "The keyboard state, voices, channels, and editable DAW tracks remain connected."],
  ["02", "Performed arrangement", "Bass, drums, guitar, riffs, ornaments, vocals, and solos follow the real section."],
  ["03", "Finished production", "Lyrics, Synthesizer V voices, brass, and strings inherit the same song context."],
]

const valueSystems = [
  {
    icon: SlidersHorizontal,
    title: "Keep the real Yamaha rig organised.",
    body: "Choose a voice on the keyboard and the correct Cubase track names itself—even across all 32 Style and Song channels. Mixes, effects, Motif arpeggios, and native Yamaha styles remain part of the production workflow.",
    outcome: "Less technical reconstruction between the keyboard and Cubase.",
  },
  {
    icon: Repeat2,
    title: "Build sections from musical performances.",
    body: "A large curated MIDI library is auditioned against the current song and adapted before export. Riff Extender develops short guitar ideas, while Solo Ornaments add instrument-specific bends, trills, slides, licks, falls, and swells.",
    outcome: "The arrangement develops instead of repeating a generic loop.",
  },
  {
    icon: WandSparkles,
    title: "Take one melody to a complete arrangement.",
    body: "SmartBridge fits singable lyrics to the notes, transfers the result to Synthesizer V, and uses the same chord progression to create humanised vocal stacks and four-part brass or string writing.",
    outcome: "One melodic idea can become a production-ready section.",
  },
]

const audiences = [
  {
    icon: SlidersHorizontal,
    label: "Yamaha + Cubase producer",
    title: "You want the keyboard to remain central after recording starts.",
    body: "SmartBridge preserves the Yamaha-specific choices and turns the hardware performance into an organised, editable Cubase project.",
  },
  {
    icon: Music2,
    label: "Songwriter and arranger",
    title: "You can find the idea, but finishing every section takes too long.",
    body: "Chord-aware performed MIDI, riff development, ornaments, lyrics, and harmonies help carry a sketch through verse, chorus, and final arrangement.",
  },
  {
    icon: Layers3,
    label: "Style creator and live player",
    title: "You want custom Yamaha accompaniment without living inside small hardware menus.",
    body: "Style Maker rebuilds native Yamaha styles in the browser, while Desktop connects style work to the wider song and production process.",
  },
]

const products = [
  {
    name: "SmartBridge Desktop",
    status: "Private beta",
    title: "The complete connected production environment.",
    body: "Control the Yamaha, define the song, build and transform performed MIDI, create vocals and harmonies, then move the result into Cubase or Synthesizer V.",
    image: "/images/desktop-v15/37_solo_ideas.png",
    href: "/features",
    cta: "See the Desktop workflow",
    pills: ["macOS + Windows", "VST3 + Standalone", "Genos · Tyros · Motif"],
    dark: true,
  },
  {
    name: "Style Maker",
    status: "$14.99/month",
    title: "Rebuild the band inside a native Yamaha style.",
    body: "Keep the donor structure, replace performances section by section, mix channels 9–16, export, and transfer the finished style to the keyboard.",
    image: "/images/desktop-v15/46_style_maker_build.png",
    href: "/style-maker",
    cta: "Try Style Maker",
    pills: ["Browser based", "14-day trial", "Native .sty/.prs"],
    dark: false,
  },
  {
    name: "Jam Player",
    status: "Free",
    title: "Practise from a real chord progression.",
    body: "Choose the progression, key, tempo, and feel, mute the instrument you play, and practise with the rest of the band directly in the browser.",
    image: "/images/desktop-v15/27_jam_player_song_chords.png",
    href: "/jam-player/app",
    cta: "Open Jam Player",
    pills: ["No installation", "Chord progressions", "Practice band"],
    dark: false,
  },
]

export default function HomePage() {
  return (
    <div className="marketing-page">
      <Hero />

      <section className={styles.proofRail} aria-label="SmartBridge core integrations">
        <div className={`m-wrap ${styles.proofRailInner}`}>
          <p className={styles.proofRailTitle}>Built around the rig you already use</p>
          <div className={styles.proofItems}>
            <span><Cable size={14} /> Genos · Tyros · PSR-SX · Motif</span>
            <span><SlidersHorizontal size={14} /> Cubase MIDI Remote</span>
            <span><AudioLines size={14} /> Synthesizer V</span>
            <span><Layers3 size={14} /> Native Yamaha styles</span>
          </div>
        </div>
      </section>

      <section className={styles.enginesSection}>
        <div className="m-wrap">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Why SmartBridge exists</p>
            <h2 className={styles.sectionTitle}>The gap is not inspiration. It is continuity.</h2>
            <p className={styles.sectionIntro}>
              Yamaha arrangers make it fast to discover a musical idea. The workflow becomes slow
              when the song loses its identity on the way to the DAW, the MIDI library, the vocal
              tool, or the orchestration stage.
            </p>
          </div>

          <div className={styles.enginesGrid}>
            {marketProblems.map((problem) => (
              <article className={styles.engineCard} key={problem.title}>
                <span className={styles.engineLabel}><problem.icon size={15} /> {problem.label}</span>
                <h3>{problem.title}</h3>
                <p>{problem.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.darkSection}`}>
        <div className={`m-wrap ${styles.contextGrid}`}>
          <div className={styles.contextCopy}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>The defining difference</p>
              <h2 className={styles.sectionTitle}>Define the song once. Reuse it everywhere.</h2>
              <p className={styles.sectionIntro}>
                Desktop JamPlayer holds the chords, sections, key, tempo, and form. The connected
                Yamaha, the performance library, Riff Extender, Solo Ornaments, lyrics, harmonies,
                Cubase, and Synthesizer V all work from that shared musical context.
                <strong> No chord re-entry and no isolated generators.</strong>
              </p>
            </div>
          </div>

          <div className={styles.contextDiagram} aria-label="SmartBridge shared song context">
            <div className={styles.contextCore}>
              <span className={styles.coreLabel}>Desktop JamPlayer · Shared song context</span>
              <h3>Verse · 8 bars · Em · 96 BPM · Straight funk</h3>
              <p>The form and harmony remain available from the first keyboard idea to the final editable production.</p>
              <div className={styles.chordGrid}>
                {["Em7", "A7", "Dmaj7", "B7"].map((chord) => <span key={chord} className={styles.chord}>{chord}</span>)}
              </div>
            </div>
            <div className={styles.outputs}>
              {connectedOutputs.map(([index, title, body]) => (
                <div className={styles.outputCard} key={title}>
                  <span className={styles.outputIndex}>{index}</span>
                  <div><strong>{title}</strong><small>{body}</small></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.systemsSection}`}>
        <div className="m-wrap">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>What changes in practice</p>
            <h2 className={styles.sectionTitle}>Three connected outcomes—not a catalogue of tools.</h2>
            <p className={styles.sectionIntro}>
              The individual features matter because they remove a specific break in the production
              chain. Together they keep the rig organised, make the arrangement sound performed,
              and carry the melody through to a finished section.
            </p>
          </div>

          <div className={styles.systemsGrid}>
            {valueSystems.map((system, index) => (
              <article className={styles.systemCard} key={system.title}>
                <div className={styles.systemTop}>
                  <span className={styles.systemNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.systemIcon}><system.icon size={19} /></span>
                </div>
                <h3>{system.title}</h3>
                <p>{system.body}</p>
                <span className={styles.systemOutcome}>{system.outcome}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.performanceSection}`}>
        <div className="m-wrap">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Who it is for</p>
            <h2 className={styles.sectionTitle}>Built for Yamaha musicians who also produce on a computer.</h2>
            <p className={styles.sectionIntro}>
              SmartBridge is most valuable when the keyboard is already an important part of the
              creative process and the computer is where the arrangement must become editable,
              repeatable, and ready to finish.
            </p>
          </div>

          <div className={styles.enginesGrid}>
            {audiences.map((audience) => (
              <article className={styles.engineCard} key={audience.title}>
                <span className={styles.engineLabel}><audience.icon size={15} /> {audience.label}</span>
                <h3>{audience.title}</h3>
                <p>{audience.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.pathSection}`}>
        <div className="m-wrap">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Choose the right entry point</p>
            <h2 className={styles.sectionTitle}>One product family, three different jobs.</h2>
            <p className={styles.sectionIntro}>
              Desktop is the complete production environment. Style Maker focuses on native Yamaha
              style creation. Jam Player is the free browser experience for practising with a chord-aware band.
            </p>
          </div>

          <div className={styles.productGrid}>
            {products.map((product) => (
              <article className={`${styles.productCard}${product.dark ? ` ${styles.productCardDark}` : ""}`} key={product.name}>
                <div className={styles.productHead}><span>{product.name}</span><strong className={styles.productStatus}>{product.status}</strong></div>
                <Image className={styles.productImage} src={product.image} alt={product.title} width={900} height={600} />
                <div className={styles.productBody}>
                  <h3>{product.title}</h3>
                  <p>{product.body}</p>
                  <div className={styles.productPills}>{product.pills.map((pill) => <span key={pill}>{pill}</span>)}</div>
                  <Link href={product.href} className={product.dark ? "m-button m-button-primary" : "m-button m-button-ink"}>
                    {product.cta} <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="m-final-cta">
        <div className="m-wrap m-final-cta-inner">
          <p className="m-eyebrow">SmartBridge Desktop</p>
          <h2>Keep the Yamaha idea connected until the production is finished.</h2>
          <div className="m-actions">
            <Link href="/features" className="m-button m-button-primary">See how Desktop works <ArrowRight size={17} /></Link>
            <a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer" className="m-button m-button-outline-light">Download Setup</a>
            <Link href="/beta" className="m-button m-button-outline-light">Request beta access</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
