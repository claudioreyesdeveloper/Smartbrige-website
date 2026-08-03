"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Check, CircleHelp, Cable, Layers3, SlidersHorizontal, Upload } from "lucide-react"
import { useState } from "react"
import { SITE } from "@/lib/site"

const workflow = [
  {
    number: "01",
    icon: Upload,
    title: "Import a donor style",
    body: "Keep the original style structure, CASM, and OTS while you rebuild the musical parts inside it.",
  },
  {
    number: "02",
    icon: Layers3,
    title: "Replace the performances",
    body: "Audition bass and drum phrases or upload your own MIDI, then assign parts section by section.",
  },
  {
    number: "03",
    icon: SlidersHorizontal,
    title: "Mix and export",
    body: "Balance channels 9–16, export a native Yamaha style file, and transfer it to your keyboard by USB.",
  },
]

const included = [
  "Curated bass and drum phrase library",
  "Custom MIDI upload on every style lane",
  "Per-section mixer for Yamaha channels 9–16",
  "CASM-aware native style export",
  "USB Musicsoft transfer to USER:\\STYLE",
  "Support for Genos, Tyros, PSR-SX, and compatible arrangers",
]

export function StyleMakerLanding() {
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [notice, setNotice] = useState("")

  const startCheckout = async () => {
    setCheckoutLoading(true)
    setNotice("")
    try {
      const response = await fetch("/api/style-maker/checkout", { method: "POST" })
      const contentType = response.headers.get("content-type") || ""
      if (!contentType.includes("application/json")) {
        window.location.href = `/sign-up?redirect_url=${encodeURIComponent("/style-maker")}`
        return
      }
      const data = await response.json()
      if (response.status === 401) {
        window.location.href = `/sign-up?redirect_url=${encodeURIComponent("/style-maker")}`
        return
      }
      if (!response.ok) throw new Error(data.error || "Checkout failed")
      if (data.url) window.location.href = data.url
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Checkout failed")
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="marketing-page mp-page">
      <section className="mp-hero">
        <div className="m-wrap mp-hero-grid">
          <div>
            <p className="m-eyebrow">SmartBridge Style Maker · Available now</p>
            <h1>Stop settling for the factory arrangement.</h1>
            <p className="mp-lead">
              Rework Yamaha arranger styles in your browser. Keep the style format, replace the
              performances, mix each section, and send the finished file back to your keyboard.
            </p>
            <div className="m-actions">
              <button className="m-button m-button-primary" onClick={startCheckout} disabled={checkoutLoading}>
                {checkoutLoading ? "Opening checkout…" : "Start 14-day free trial"}
                <ArrowRight size={17} />
              </button>
              <Link href="/sign-in?redirect_url=/style-maker/app" className="m-button m-button-quiet">Sign in</Link>
            </div>
            {notice && <p className="mp-notice" role="status">{notice}</p>}
            <p className="mp-fineprint">Then $14.99/month · Card required · Cancel anytime</p>
          </div>

          <article className="mp-price-panel">
            <div className="mp-price-panel-top">
              <span>Full access</span>
              <span>14 days free</span>
            </div>
            <div className="mp-price-line"><strong>$14.99</strong><span>/ month</span></div>
            <p>Everything you need to rebuild, audition, export, and transfer Yamaha styles.</p>
            <ul>
              {included.map((item) => <li key={item}><Check size={16} /> {item}</li>)}
            </ul>
            <button className="m-button m-button-primary" onClick={startCheckout} disabled={checkoutLoading}>
              {checkoutLoading ? "Opening checkout…" : "Start free trial"}<ArrowRight size={17} />
            </button>
          </article>
        </div>
      </section>

      <section className="m-section mp-showcase">
        <div className="m-wrap">
          <div className="m-section-heading m-section-heading-split">
            <div><p className="m-eyebrow">A focused workflow</p><h2>Hear the change before you export it.</h2></div>
            <p>Style Maker keeps auditioning, arrangement, and mixing together, so every choice is made in musical context.</p>
          </div>
          <div className="mp-image-frame">
            <div className="m-window-bar"><span /><span /><span /><strong>SmartBridge · Phrase audition</strong></div>
            <Image src="/images/bass-library.png" alt="Bass phrases organised by genre, section, feel, and tempo" width={1287} height={896} />
          </div>
        </div>
      </section>

      <section className="m-section mp-workflow">
        <div className="m-wrap">
          <div className="m-section-heading"><p className="m-eyebrow">How it works</p><h2>Three stages. One playable result.</h2></div>
          <div className="m-step-grid">
            {workflow.map((step) => (
              <article className="m-step-card" key={step.title}>
                <div className="m-step-top"><span>{step.number}</span><step.icon size={22} /></div>
                <h3>{step.title}</h3><p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mp-requirements">
        <div className="m-wrap mp-requirements-grid">
          <div><Cable size={24} /><h2>What you need</h2></div>
          <p>A supported Yamaha arranger keyboard, a USB connection, and desktop Chrome or Edge. Mobile devices are not supported yet.</p>
          <a href={`mailto:${SITE.email}?subject=${encodeURIComponent("Style Maker compatibility question")}`} className="m-text-link">
            <CircleHelp size={16} /> Ask about compatibility
          </a>
        </div>
      </section>

      <section className="m-final-cta">
        <div className="m-wrap m-final-cta-inner">
          <p className="m-eyebrow">Your keyboard. Your arrangement.</p>
          <h2>Build a style that sounds like your band, not everyone else’s.</h2>
          <div className="m-actions">
            <button className="m-button m-button-primary" onClick={startCheckout} disabled={checkoutLoading}>
              Start 14-day free trial <ArrowRight size={17} />
            </button>
            <Link href="/style-maker/app" className="m-button m-button-outline-light">Open the app</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
