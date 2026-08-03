import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Download, FlaskConical, KeyRound, Mail, Monitor } from "lucide-react"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Get SmartBridge Desktop",
  description: "Download SmartBridge Desktop Setup and request activation for the complete macOS and Windows workflow.",
}

const steps = [
  { icon: Mail, title: "Request an invitation", body: "Tell Claudio which Yamaha keyboard and DAW you use, and what you want SmartBridge to solve." },
  { icon: Download, title: "Download Setup", body: "Invited testers receive the correct macOS or Windows installer and activation details." },
  { icon: KeyRound, title: "Activate the beta", body: "Use your email and beta serial to activate the desktop suite on your studio computer." },
]

export default function BetaPage() {
  return (
    <div className="marketing-page mp-page editorial-page">
      <section className="beta-hero">
        <div className="m-wrap beta-hero-grid">
          <div>
            <p className="m-eyebrow">SmartBridge desktop suite</p>
            <h1>Put the complete SmartBridge workflow on your machine.</h1>
            <p>
              SmartBridge Desktop connects Yamaha keyboard control, chord-aware arranging,
              performance libraries, vocals, lyrics, solos, harmony, and DAW production. Download
              Setup for macOS or Windows, then request activation for the current beta release.
            </p>
            <div className="m-actions">
              <a href={`mailto:${SITE.email}?subject=${encodeURIComponent("SmartBridge desktop beta request")}`} className="m-button m-button-primary">
                Request beta access <ArrowRight size={17} />
              </a>
              <a href={SITE.setupUrl} className="m-button m-button-quiet" target="_blank" rel="noopener noreferrer">Download Setup</a>
            </div>
          </div>
          <div className="beta-status-card">
            <FlaskConical size={26} />
            <span>SmartBridge Desktop</span>
            <h2>For macOS Apple Silicon and Windows x64</h2>
            <p>VST3 + standalone · Yamaha USB MIDI · Cubase and Synthesizer V integrations</p>
          </div>
        </div>
      </section>

      <section className="m-section">
        <div className="m-wrap">
          <div className="m-section-heading m-section-heading-split">
            <div><p className="m-eyebrow">Desktop access</p><h2>Download, activate, and connect your rig.</h2></div>
            <p>Desktop is a primary SmartBridge product. The current release uses invitation-based beta activation while the complete keyboard and production workflow is refined with musicians.</p>
          </div>
          <div className="m-step-grid">
            {steps.map((step, index) => (
              <article key={step.title} className="m-step-card">
                <div className="m-step-top"><span>0{index + 1}</span><step.icon size={22} /></div>
                <h3>{step.title}</h3><p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="beta-available-now">
        <div className="m-wrap beta-available-grid">
          <Monitor size={28} />
          <div><p className="m-eyebrow">Also available in the browser</p><h2>Style Maker is the focused style workflow.</h2><p>Build and transfer Yamaha arranger styles in the browser with a full 14-day trial.</p></div>
          <Link href="/style-maker" className="m-button m-button-primary">Explore Style Maker <ArrowRight size={17} /></Link>
        </div>
      </section>
    </div>
  )
}
