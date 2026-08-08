import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  AudioLines,
  Cable,
  Gauge,
  Headphones,
  Layers3,
  Music2,
  Repeat2,
  SlidersHorizontal,
  VolumeX,
  WandSparkles,
} from "lucide-react"
import { Hero } from "@/components/hero"
import { SITE } from "@/lib/site"
import styles from "@/components/marketing-redesign.module.css"

const connectedOutputs = [
  ["01", "Yamaha hardware", "Voices, effects, styles, arpeggios, and saved keyboard state."],
  ["02", "Performed MIDI", "Bass, drums, guitar, vocals, and solos adapted to the current section."],
  ["03", "Solo intelligence", "Riff continuation plus instrument-specific bends, trills, licks, slides, and falls."],
  ["04", "Vocal production", "Melody-fitted lyrics, backing voices, and direct Synthesizer V handoff."],
  ["05", "Section harmony", "Four-part vocal, brass, and string writing from the same chord progression."],
  ["06", "Cubase", "Correctly named tracks and editable MIDI that already belongs to the song."],
]

const signatureSystems = [
  {
    icon: SlidersHorizontal,
    title: "Cubase Auto Renamer",
    body: "Pick a voice on the Yamaha keyboard and SmartBridge updates the correct Cubase track name automatically—even across all 32 Style and Song channels.",
    outcome: "The DAW project always reflects the real keyboard setup.",
  },
  {
    icon: Layers3,
    title: "Chord-aware performance library",
    body: "A large curated library of bass, drums, guitars, vocals, and solo phrases is auditioned inside JamPlayer and adapted to the actual chords before export.",
    outcome: "Drag the MIDI into Cubase; the verse and chorus notes are already right.",
  },
  {
    icon: Repeat2,
    title: "Riff Extender",
    body: "Start with a strong one- or two-bar rock, pop, or funk guitar riff. SmartBridge develops it through the remaining bars of the section while following every chord.",
    outcome: "Keep the identity of the riff without mechanical repetition.",
  },
  {
    icon: WandSparkles,
    title: "Solo Ornaments",
    body: "Turn a plain guitar or woodwind line into a performed phrase with instrument-specific trills, bends, licks, slides, falls, pickups, and swells placed in harmonic context.",
    outcome: "Expression is built into the editable MIDI—not added as an afterthought.",
  },
  {
    icon: AudioLines,
    title: "Melody-to-Lyrics",
    body: "SmartBridge analyses the melody itself, fits words to its notes, handles syllables, melisma, short notes, repeated hooks, and phrasing, then sends the result to Synthesizer V.",
    outcome: "The words are written to the melody you composed.",
  },
  {
    icon: Music2,
    title: "Three harmony engines",
    body: "The same JamPlayer progression drives humanised vocal stacks, four-part horn writing, and practical violin, viola, and cello arrangements from a single melody.",
    outcome: "One line becomes a complete arranged section with separate editable voices.",
  },
]

const performanceBenefits = [
  "Filter played material by genre, section, tempo, feel, density, articulation, and musical purpose.",
  "Preserve slides, hammer-ons, pitch bends, controllers, and Yamaha MegaVoice velocity layers.",
  "Audition every phrase with the current band before committing it to the arrangement.",
  "Export editable MIDI by section instead of searching folders and transposing patterns by hand.",
]

const products = [
  {
    name: "SmartBridge Desktop",
    status: "Private beta",
    title: "The complete connected production environment.",
    body: "Control the Yamaha, build the song, choose and transform performed MIDI, create vocals and harmonies, then move the complete result into Cubase or Synthesizer V.",
    image: "/images/desktop-v15/37_solo_ideas.png",
    href: "/features",
    cta: "Explore Desktop",
    pills: ["macOS + Windows", "VST3 + Standalone", "Genos · Tyros · Motif"],
    dark: true,
  },
  {
    name: "Style Maker",
    status: "$14.99/month",
    title: "Rebuild the band inside a native Yamaha style.",
    body: "Keep the donor style structure, replace performances section by section, mix channels 9–16, export, and transfer the finished style to the keyboard.",
    image: "/images/desktop-v15/46_style_maker_build.png",
    href: "/style-maker",
    cta: "Try Style Maker",
    pills: ["Browser based", "14-day trial", "Native .sty/.prs"],
    dark: false,
  },
  {
    name: "Jam Player",
    status: "Free",
    title: "Start with the song, not an empty timeline.",
    body: "Choose the progression, key, tempo, and feel, mute the instrument you play, and practise with the band. The same song can continue into the SmartBridge workflow.",
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
          <p className={styles.proofRailTitle}>One connected production chain</p>
          <div className={styles.proofItems}>
            <span><Cable size={14} /> Genos · Tyros · PSR-SX · Motif</span>
            <span><SlidersHorizontal size={14} /> Cubase MIDI Remote</span>
            <span><AudioLines size={14} /> Synthesizer V</span>
            <span><Layers3 size={14} /> Native Yamaha styles</span>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.darkSection}`}>
        <div className={`m-wrap ${styles.contextGrid}`}>
          <div className={styles.contextCopy}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>The central idea</p>
              <h2 className={styles.sectionTitle}>The song is the system.</h2>
              <p className={styles.sectionIntro}>
                JamPlayer is more than a chord grid. It is the shared musical context for the whole
                product. Define the chords, sections, key, and tempo once; every SmartBridge engine
                reads the same information. <strong>No chord re-entry. No disconnected generators.</strong>
              </p>
            </div>
          </div>

          <div className={styles.contextDiagram} aria-label="JamPlayer connected song model">
            <div className={styles.contextCore}>
              <span className={styles.coreLabel}>JamPlayer · Shared song context</span>
              <h3>Verse · 8 bars · Em · 96 BPM · Straight funk</h3>
              <p>The same form and harmony follows every performance, voice, lyric, ornament, harmony part, and export.</p>
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
            <p className={styles.eyebrow}>Six signature systems</p>
            <h2 className={styles.sectionTitle}>Not six disconnected plug-ins.</h2>
            <p className={styles.sectionIntro}>
              Each capability is useful on its own. The market advantage comes from their sharing
              the same song, the same Yamaha rig, and the same production destination.
            </p>
          </div>

          <div className={styles.systemsGrid}>
            {signatureSystems.map((system, index) => (
              <article className={`${styles.systemCard}${index < 2 ? ` ${styles.systemCardLarge}` : ""}`} key={system.title}>
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
        <div className={`m-wrap ${styles.performanceGrid}`}>
          <div className={styles.performanceCopy}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>Curated performances</p>
              <h2 className={styles.sectionTitle}>Drag performances, not generic patterns.</h2>
              <p className={styles.sectionIntro}>
                SmartBridge combines a large played MIDI library with JamPlayer&apos;s song knowledge.
                The phrase is selected for its musical job, then adapted to the real progression
                before it reaches Cubase.
              </p>
            </div>
            <ul className={styles.featureList}>
              {performanceBenefits.map((benefit, index) => (
                <li className={styles.featureListItem} key={benefit}>
                  <span>{index + 1}</span><p>{benefit}</p>
                </li>
              ))}
            </ul>
            <div className={styles.performanceStatement}>
              Drop the bass line into Cubase and it already follows the chords of that exact verse or chorus.
            </div>
          </div>

          <div className={styles.performanceGallery}>
            <article className={styles.screenshotCard}>
              <Image src="/images/desktop-v15/29_bass_performance.png" alt="SmartBridge chord-aware bass performance library" width={1000} height={667} />
              <div className={styles.screenshotMeta}><span>Bass performances</span><span>MegaVoice aware</span></div>
            </article>
            <article className={styles.screenshotCard}>
              <Image src="/images/desktop-v15/30_drum_performance.png" alt="SmartBridge drum groove and matching fill library" width={800} height={533} />
              <div className={styles.screenshotMeta}><span>Drums &amp; fills</span><span>Section aware</span></div>
            </article>
            <article className={styles.screenshotCard}>
              <Image src="/images/desktop-v15/31_rhythm_guitar.png" alt="SmartBridge chord-aware rhythm guitar workflow" width={800} height={533} />
              <div className={styles.screenshotMeta}><span>Rhythm guitar</span><span>Chord fitted</span></div>
            </article>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.expressionSection}`}>
        <div className="m-wrap">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Expression and development</p>
            <h2 className={styles.sectionTitle}>The idea does not have to repeat like a robot.</h2>
            <p className={styles.sectionIntro}>
              SmartBridge can continue the musical identity of a short riff and can transform a plain
              solo into an instrument-specific performance—all while reading the next chord in the song.
            </p>
          </div>

          <div className={styles.expressionGrid}>
            <article className={styles.expressionCard}>
              <h3>Riff Extender</h3>
              <p>Keep the original one- or two-bar guitar idea, then generate a convincing continuation through the remaining bars of the section.</p>
              <div className={styles.riffTimeline} aria-label="Two original riff bars extended through an eight-bar section">
                {["Em7", "Em7", "A7", "A7", "Dmaj7", "Dmaj7", "B7", "B7"].map((chord, index) => (
                  <div className={`${styles.riffBar} ${index < 2 ? styles.riffOriginal : styles.riffGenerated}`} key={`${chord}-${index}`}>
                    <span className={styles.riffChord}>{chord}</span>
                  </div>
                ))}
              </div>
              <div className={styles.riffTag}><strong>Bars 1–2 · Your riff</strong><strong>Bars 3–8 · Chord-aware extension</strong></div>
            </article>

            <article className={styles.expressionCard}>
              <h3>Solo Ornaments</h3>
              <p>Add real guitar, woodwind, brass, or string gestures in musical positions instead of scattering random notes around the phrase.</p>
              <div className={styles.ornamentStage} aria-label="Illustration of a solo line with expressive ornaments">
                <span className={styles.noteLine} />
                {[0, 1, 2, 3, 4].map((item) => <span className={styles.noteDot} key={item} />)}
              </div>
              <div className={styles.gestureList}>
                {["Bend", "Trill", "Pickup lick", "Slide", "Fall", "Swell", "Approach note", "Riff"].map((gesture) => (
                  <span className={styles.gesturePill} key={gesture}>{gesture}</span>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.vocalSection}`}>
        <div className="m-wrap">
          <div className={styles.vocalGrid}>
            <div className={styles.vocalImage}>
              <div className={styles.windowBar}><i /><i /><i /><strong>SmartBridge · Lyrics &amp; Synthesizer V</strong></div>
              <Image src="/images/desktop-v15/35_vocals_daw_import.png" alt="SmartBridge mapping generated lyrics to a MIDI melody for Synthesizer V" width={1100} height={733} />
            </div>
            <div className={styles.vocalCopy}>
              <div className={styles.sectionHeader}>
                <p className={styles.eyebrow}>From melody to performed vocal</p>
                <h2 className={styles.sectionTitle}>The lyrics fit the notes you already wrote.</h2>
                <p className={styles.sectionIntro}>
                  SmartBridge analyses phrase length, note duration, syllable count, repeated hooks,
                  melisma, and short-note delivery. It then maps the words syllable by syllable and
                  sends the completed vocal to Synthesizer V at the correct position.
                </p>
              </div>
              <p className={styles.vocalQuote}>Write the melody first. Let the words follow its musical phrasing.</p>
            </div>
          </div>

          <div className={styles.harmoniesGrid}>
            {[
              ["/images/desktop-v15/34_vocals_harmonizer.png", "Vocal Harmonizer", "Build humanised backing voices under the lead and export each singer separately."],
              ["/images/desktop-v15/39_brass_harmonizer.png", "Brass Harmonizer", "Turn one melody into range-aware four-part horn writing that follows the song."],
              ["/images/desktop-v15/40_strings_harmonizer.png", "Strings Harmonizer", "Create violin, viola, cello, and support layers with practical registers and textures."],
            ].map(([image, title, body]) => (
              <article className={styles.harmonyCard} key={title}>
                <Image className={styles.harmonyImage} src={image} alt={`SmartBridge ${title}`} width={800} height={533} />
                <div className={styles.harmonyText}><h3>{title}</h3><p>{body}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.pathSection}`}>
        <div className="m-wrap">
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>Choose the entry point</p>
            <h2 className={styles.sectionTitle}>One musical system. Three ways in.</h2>
            <p className={styles.sectionIntro}>Desktop is the complete environment. Style Maker focuses the native Yamaha style workflow. Jam Player lets anyone begin with the song for free.</p>
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

      <section className="m-section m-jam-section">
        <div className="m-wrap m-jam-grid">
          <div className="m-jam-copy">
            <p className="m-eyebrow">Jam Player · Free in the browser</p>
            <h2>Start with a real song context.</h2>
            <p>Choose the progression, key, tempo, and feel. Mute the instrument you play and practise with the rest of the band—the same musical model that powers SmartBridge Desktop.</p>
            <div className="m-mini-features">
              <span><VolumeX size={17} /> Mute your part</span>
              <span><Gauge size={17} /> Set the tempo</span>
              <span><Repeat2 size={17} /> Loop cleanly</span>
              <span><Headphones size={17} /> Play with the band</span>
            </div>
            <Link href="/jam-player/app" className="m-button m-button-ink">Open Jam Player free <ArrowRight size={17} /></Link>
          </div>
          <div className="m-jam-player-card">
            <div className="m-jam-player-head"><span><Music2 size={18} /> Funk pocket</span><span>96 BPM · Em</span></div>
            <div className="m-chord-row"><span className="is-playing">Em7</span><span>A7</span><span>Dmaj7</span><span>B7</span></div>
            <div className="m-mixer-row">
              {[["DR", "Drums", "78%"], ["BS", "Bass", "Muted"], ["GT", "Guitar", "64%"], ["KY", "Keys", "52%"]].map(([short, name, level]) => (
                <div key={name} className={level === "Muted" ? "is-muted" : ""}><span className="m-track-icon">{short}</span><strong>{name}</strong><small>{level}</small></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="m-final-cta">
        <div className="m-wrap m-final-cta-inner">
          <p className="m-eyebrow">SmartBridge Desktop</p>
          <h2>Build the song once. Carry its intelligence to the finished production.</h2>
          <div className="m-actions">
            <Link href="/features" className="m-button m-button-primary">Explore Desktop <ArrowRight size={17} /></Link>
            <a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer" className="m-button m-button-outline-light">Download Setup</a>
            <Link href="/beta" className="m-button m-button-outline-light">Request beta access</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
