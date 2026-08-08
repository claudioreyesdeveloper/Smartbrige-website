import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Download } from "lucide-react"
import { SITE } from "@/lib/site"
import styles from "@/components/marketing-redesign.module.css"

const signals = [
  "32 Cubase tracks named from the Yamaha voices",
  "Editable performances already fitted to the chords",
  "Lyrics written to the notes of the melody",
  "Vocal, brass, and string parts from one song",
]

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={`m-wrap ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <div className={styles.heroKicker}>
            <span className={styles.heroKickerDot} />
            The chord-aware production system for Yamaha musicians
          </div>
          <h1 className={styles.heroTitle}>
            One song.
            <span>Every part understands it.</span>
          </h1>
          <p className={styles.heroLead}>
            SmartBridge gives your Yamaha arranger, Cubase, Synthesizer V, performance
            libraries, solos, lyrics, and harmonies the same chords, sections, key, and tempo.
            Build the song once, then carry its musical intelligence through the entire production.
          </p>
          <div className="m-actions" style={{ marginTop: "2.15rem" }}>
            <Link href="/features" className="m-button m-button-primary">
              Explore SmartBridge Desktop <ArrowRight size={17} />
            </Link>
            <a href={SITE.setupUrl} target="_blank" rel="noopener noreferrer" className="m-button m-button-quiet">
              Download Setup <Download size={17} />
            </a>
          </div>
          <div className={styles.heroSignals} aria-label="SmartBridge signature capabilities">
            {signals.map((signal) => (
              <span className={styles.signal} key={signal}>
                <CheckCircle2 size={15} /> {signal}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.heroVisual} aria-label="SmartBridge connected song workflow">
          <div className={styles.heroGlow} />
          <p className={styles.heroCaption}>JamPlayer is the shared musical context—not another isolated tool.</p>
          <div className={styles.heroWindow}>
            <div className={styles.windowBar}>
              <i /><i /><i />
              <strong>SmartBridge Desktop · Song &amp; Chords</strong>
            </div>
            <Image
              className={styles.heroImage}
              src="/images/desktop-v15/27_jam_player_song_chords.png"
              alt="SmartBridge JamPlayer sharing a song and chord progression across the production workflow"
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
            <span className={styles.orbitLabel}>Performance library</span>
            <span className={styles.orbitValue}>Bass · Drums · Guitar · Solos</span>
          </div>
        </div>
      </div>
    </section>
  )
}
