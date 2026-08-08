import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Download } from "lucide-react"
import { SITE } from "@/lib/site"
import styles from "@/components/marketing-redesign.module.css"

const signals = [
  "Keep the Yamaha as the sound and performance centre",
  "Turn performed MIDI into complete chord-aware sections",
  "Send organised, editable material into Cubase and Synthesizer V",
]

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={`m-wrap ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <div className={styles.heroKicker}>
            <span className={styles.heroKickerDot} />
            One song. Every part understands it.
          </div>
          <h1 className={styles.heroTitle}>
            Turn Yamaha ideas into finished productions.
            <span>Without rebuilding the song.</span>
          </h1>
          <p className={styles.heroLead}>
            SmartBridge connects the Yamaha arranger, performed MIDI, Cubase, Synthesizer V,
            lyrics, solos, and harmony to the same chords, sections, key, and tempo. The musical
            context travels with the song from the keyboard to the final editable tracks.
          </p>
          <div className="m-actions" style={{ marginTop: "2.15rem" }}>
            <Link href="/features" className="m-button m-button-primary">
              See the connected workflow <ArrowRight size={17} />
            </Link>
            <a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer" className="m-button m-button-quiet">
              Download Desktop Setup <Download size={17} />
            </a>
          </div>
          <div className={styles.heroSignals} aria-label="SmartBridge customer outcomes">
            {signals.map((signal) => (
              <span className={styles.signal} key={signal}>
                <CheckCircle2 size={15} /> {signal}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.heroVisual} aria-label="SmartBridge connected song workflow">
          <div className={styles.heroGlow} />
          <p className={styles.heroCaption}>The song remains the shared context from the Yamaha performance to the finished production.</p>
          <div className={styles.heroWindow}>
            <div className={styles.windowBar}>
              <i /><i /><i />
              <strong>SmartBridge Desktop · Song &amp; Chords</strong>
            </div>
            <Image
              className={styles.heroImage}
              src="/images/desktop-v15/27_jam_player_song_chords.png"
              alt="SmartBridge Desktop sharing one song and chord progression across the production workflow"
              width={1280}
              height={853}
              priority
            />
          </div>
          <div className={`${styles.orbitCard} ${styles.orbitYamaha}`}>
            <span className={styles.orbitLabel}>Yamaha</span>
            <span className={styles.orbitValue}>Voices · Styles · Effects</span>
          </div>
          <div className={`${styles.orbitCard} ${styles.orbitCubase}`}>
            <span className={styles.orbitLabel}>Cubase</span>
            <span className={styles.orbitValue}>Named tracks · Editable MIDI</span>
          </div>
          <div className={`${styles.orbitCard} ${styles.orbitSynth}`}>
            <span className={styles.orbitLabel}>Synthesizer V</span>
            <span className={styles.orbitValue}>Lyrics · Lead · Harmonies</span>
          </div>
          <div className={`${styles.orbitCard} ${styles.orbitLibrary}`}>
            <span className={styles.orbitLabel}>Performed MIDI</span>
            <span className={styles.orbitValue}>Bass · Drums · Guitar · Solos</span>
          </div>
        </div>
      </div>
    </section>
  )
}
