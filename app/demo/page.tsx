import Link from "next/link"
import {
  ArrowRight,
  Chrome,
  Clock3,
  Music2,
  SlidersHorizontal,
  Sparkles,
  Usb,
} from "lucide-react"
import { BrowserCompatibility } from "@/components/demo/browser-compatibility"
import { SITE } from "@/lib/site"

export const metadata = {
  title: "Demo Station",
  description: "Experience SmartBridge directly on your Yamaha arranger keyboard.",
}

export default function DemoStationPage() {
  return (
    <BrowserCompatibility>
    <div className="demo-station">
      <div className="demo-station-orb demo-station-orb-one" />
      <div className="demo-station-orb demo-station-orb-two" />
      <header className="demo-station-header">
        <Link href="/" className="demo-wordmark">SmartBridge</Link>
        <span className="demo-lab-badge"><Sparkles size={14} /> Demo Station</span>
      </header>

      <main className="demo-station-main">
        <div className="demo-station-copy">
          <p className="ux-section-label" style={{ color: "inherit", opacity: 0.85 }}>
            Demo Station
          </p>
          <p className="demo-kicker">Your keyboard. Reimagined.</p>
          <h1>Try SmartBridge on your arranger.</h1>
          <p>
            Pick a demo, connect with USB, and follow the steps. No account and no
            technical setup — just Chrome/Edge and your Yamaha keyboard.
          </p>
        </div>

        <section className="browser-requirement-card" aria-label="Browser requirement">
          <Chrome size={34} />
          <div>
            <strong>Use Google Chrome or Microsoft Edge on a computer</strong>
            <span>
              This demo does not work in Safari, Firefox, on phones, or on tablets.
              iOS and Android may be supported later — contact{" "}
              <a href={`mailto:${SITE.email}?subject=${encodeURIComponent("SmartBridge iOS / Android")}`}>
                {SITE.email}
              </a>{" "}
              for more information.
            </span>
          </div>
        </section>

        <div className="demo-choice-grid">
          <Link href="/demo/jam-player" className="demo-choice-card demo-choice-jam">
            <div className="demo-choice-top">
              <span className="demo-choice-icon"><Music2 size={24} /></span>
              <span className="demo-choice-time"><Clock3 size={14} /> About 3 minutes</span>
            </div>
            <div>
              <span className="demo-choice-number">01</span>
              <h2>Jam Player</h2>
              <h3>Play any song instantly.</h3>
              <p>Choose a song, press the large Play button, then change the band while the song continues.</p>
            </div>
            <div className="mini-timeline" aria-hidden="true">
              <span style={{ width: "28%" }}>VERSE</span>
              <span style={{ width: "18%" }}>PRE</span>
              <span className="is-hot" style={{ width: "36%" }}>CHORUS</span>
              <i />
            </div>
            <strong className="demo-choice-cta">Launch Jam Player <ArrowRight size={18} /></strong>
          </Link>

          <Link href="/demo/style-maker" className="demo-choice-card demo-choice-style">
            <div className="demo-choice-top">
              <span className="demo-choice-icon"><SlidersHorizontal size={24} /></span>
              <span className="demo-choice-time"><Clock3 size={14} /> Under 30 seconds</span>
            </div>
            <div>
              <span className="demo-choice-number">02</span>
              <h2>Style Maker</h2>
              <h3>Build a better style.</h3>
              <p>Choose a Yamaha style file, improve its bass and drums, then load it into your keyboard.</p>
            </div>
            <div className="lane-preview" aria-hidden="true">
              <span><i /> Original style</span>
              <span className="is-hot"><i /> SmartBridge bass</span>
              <span className="is-hot"><i /> SmartBridge drums</span>
            </div>
            <strong className="demo-choice-cta">Launch Style Maker <ArrowRight size={18} /></strong>
          </Link>
        </div>

        <div className="demo-requirements">
          <span><Chrome size={17} /> Chrome or Edge on a computer</span>
          <span><Usb size={17} /> Genos, Genos2, Tyros4, or Tyros5 with a USB cable</span>
          <span>No login. No registration.</span>
        </div>
      </main>
    </div>
    </BrowserCompatibility>
  )
}
