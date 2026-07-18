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

export const metadata = {
  title: "Demo Station",
  description: "Experience SmartBridge directly on your Yamaha arranger keyboard.",
}

export default function DemoStationPage() {
  return (
    <div className="demo-station">
      <div className="demo-station-orb demo-station-orb-one" />
      <div className="demo-station-orb demo-station-orb-two" />
      <header className="demo-station-header">
        <Link href="/" className="demo-wordmark">SmartBridge</Link>
        <span className="demo-lab-badge"><Sparkles size={14} /> Demo Station</span>
      </header>

      <main className="demo-station-main">
        <div className="demo-station-copy">
          <p className="demo-kicker">Your keyboard. Reimagined.</p>
          <h1>Experience the future of Yamaha arranger keyboards.</h1>
          <p>
            Connect over USB and hear SmartBridge transform a full arrangement or
            rebuild a Yamaha style—directly in your browser.
          </p>
        </div>

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
              <p>
                Choose a complete arrangement, press Play, then switch from Jazz
                to Gospel, Neo Soul, Pop, or Funk while the song keeps moving.
              </p>
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
              <p>
                Upload your Yamaha style, replace its bass and drums, compare the
                result, then send it straight into USER:\STYLE.
              </p>
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
          <span><Chrome size={17} /> Chrome or Edge desktop</span>
          <span><Usb size={17} /> Genos, Genos2, Tyros4, or Tyros5 over USB</span>
          <span>No login. No registration.</span>
        </div>
      </main>
    </div>
  )
}
