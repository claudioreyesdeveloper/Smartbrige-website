import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, HeartHandshake, Music2, Wrench } from "lucide-react"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "About",
  description: "Meet Claudio Reyes, the Yamaha musician and independent developer behind SmartBridge.",
}

export default function AboutPage() {
  return (
    <div className="marketing-page mp-page editorial-page">
      <section className="editorial-hero">
        <div className="m-wrap editorial-hero-grid">
          <div>
            <p className="m-eyebrow">About SmartBridge</p>
            <h1>Built at the keyboard, not in a boardroom.</h1>
            <p>
              SmartBridge is an independent music-software project by Claudio Reyes — a Yamaha
              keyboard musician who wanted a better bridge between arranger workflows and the computer.
            </p>
          </div>
          <div className="editorial-portrait">
            <Image src="/images/claudio-reyes-studio.jpg" alt="Claudio Reyes working in his music studio" width={900} height={1200} priority />
            <span>Claudio Reyes · Musician and creator of SmartBridge</span>
          </div>
        </div>
      </section>

      <section className="m-section editorial-story">
        <div className="m-wrap editorial-story-grid">
          <p className="m-eyebrow">Why it exists</p>
          <div>
            <h2>The keyboard was inspiring. The workflow around it was not.</h2>
            <p>
              SmartBridge began as a practical studio tool. Claudio could find an idea quickly on
              his Yamaha keyboard, but reshaping a style, managing musical parts, and moving the
              result into a computer workflow meant too many menus, files, and disconnected steps.
            </p>
            <p>
              So he started building the tools he wanted to use himself. SmartBridge Desktop grew
              into a complete control room for the keyboard, the song, musical performances,
              vocals, solos, harmony, Cubase, and Synthesizer V.
            </p>
            <p>
              Style Maker brings the native Yamaha style workflow into the browser, while Jam Player
              uses SmartBridge’s musical library as a patient practice band. They are focused
              products alongside the equally important Desktop environment.
            </p>
          </div>
        </div>
      </section>

      <section className="m-section editorial-values">
        <div className="m-wrap">
          <div className="m-section-heading"><p className="m-eyebrow">The way it is built</p><h2>Small, specific, and musician-led.</h2></div>
          <div className="editorial-value-grid">
            {[
              { icon: Music2, title: "Musical context first", body: "Features are judged by whether they help a real arranging or practice session — not by how impressive the feature list looks." },
              { icon: Wrench, title: "Built for a real rig", body: "The workflow starts with the keyboard, USB connection, style format, and the awkward details that generic music software often ignores." },
              { icon: HeartHandshake, title: "Independent and direct", body: "SmartBridge is developed by one musician for other musicians. Questions and feedback reach the person actually building the product." },
            ].map((value) => (
              <article key={value.title}><value.icon size={23} /><h3>{value.title}</h3><p>{value.body}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="m-final-cta">
        <div className="m-wrap m-final-cta-inner">
          <p className="m-eyebrow">Talk to the person building it</p>
          <h2>Have a Yamaha workflow SmartBridge should understand?</h2>
          <div className="m-actions">
            <a href={`mailto:${SITE.email}`} className="m-button m-button-primary">Email Claudio <ArrowRight size={17} /></a>
            <Link href="/features" className="m-button m-button-outline-light">Explore Desktop</Link>
            <Link href="/style-maker" className="m-button m-button-outline-light">Explore Style Maker</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
