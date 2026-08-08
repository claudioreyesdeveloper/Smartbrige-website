import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Download, FlaskConical, KeyRound, Mail, Monitor } from "lucide-react"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Get SmartBridge Desktop",
  description: "Download and request beta access to the chord-aware Yamaha, Cubase, and Synthesizer V production environment.",
}

const steps = [
  { icon: Mail, title: "Describe your rig", body: "Tell Claudio which Yamaha keyboard, operating system, DAW, and vocal tools you use so the correct workflow can be confirmed." },
  { icon: Download, title: "Install SmartBridge", body: "Download the current macOS or Windows setup containing the standalone application and VST3 integration." },
  { icon: KeyRound, title: "Activate the beta", body: "Use the invitation details to activate SmartBridge and connect the Yamaha, Cubase, and the shared song workflow." },
]

export default function BetaPage() {
  return (
    <div className="marketing-page mp-page editorial-page">
      <section className="beta-hero">
        <div className="m-wrap beta-hero-grid">
          <div>
            <p className="m-eyebrow">SmartBridge Desktop beta</p>
            <h1>Put the connected song system on your studio machine.</h1>
            <p>
              SmartBridge Desktop shares one chord-aware song across Yamaha keyboard control,
              automatically named Cubase tracks, performed MIDI, Riff Extender, Solo Ornaments,
              melody-fitted lyrics, Synthesizer V, and four-part harmony.
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
            <p>VST3 + standalone · Yamaha USB MIDI · Cubase MIDI Remote · Synthesizer V workflow</p>
          </div>
        </div>
      </section>

      <section className="m-section">
        <div className="m-wrap">
          <div className="m-section-heading m-section-heading-split">
            <div><p className="m-eyebrow">Desktop access</p><h2>Connect the real rig, not a generic demo setup.</h2></div>
            <p>The beta is invitation-based because SmartBridge reaches into the details of specific Yamaha models, MIDI drivers, Cubase projects, and production workflows. The goal is a reliable first result on the user&apos;s actual system.</p>
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
          <div><p className="m-eyebrow">Available immediately in the browser</p><h2>Style Maker is the focused Yamaha style workflow.</h2><p>Import a donor style, replace its performances, mix each section, export a native Yamaha file, and transfer it to the keyboard.</p></div>
          <Link href="/style-maker" className="m-button m-button-primary">Explore Style Maker <ArrowRight size={17} /></Link>
        </div>
      </section>
    </div>
  )
}
