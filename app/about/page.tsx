import type { Metadata } from "next"
import Image from "next/image"
import { CtaBand } from "@/components/cta-band"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "About",
  description:
    "SmartBridge is an independent project built from real musician workflow needs — connecting Yamaha keyboards to modern production.",
}

export default function AboutPage() {
  return (
    <div className="page-shell">
      <div className="content-wrap">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-start">
          <div>
            <p className="section-label">About</p>
            <h1 className="section-title mt-3">Built from real workflow friction</h1>
            <div className="mt-6 space-y-4 prose-muted">
              <p>
                SmartBridge started as a practical answer to a problem many Yamaha keyboard
                musicians know: the gap between generating ideas on the hardware and finishing
                arrangements on the computer.
              </p>
              <p>
                Loop libraries give you files. DAWs give you a blank timeline. The keyboard gives
                you performance power — but the three rarely share the same musical context.
                SmartBridge connects them: phrases stay inside chord progressions and song
                sections, vocals and lyrics stay tied to the arrangement, and export paths lead
                into Cubase and other DAWs without rebuilding everything from scratch.
              </p>
              <p>
                It is an independent project by Claudio Reyes, developed alongside real songwriting
                and arrangement sessions — not affiliated with Yamaha Corporation.
              </p>
            </div>
            <a
              href={`mailto:${SITE.email}`}
              className="mt-8 inline-flex btn-secondary"
            >
              Get in touch
            </a>
          </div>

          <div className="card-surface overflow-hidden">
            <Image
              src="/images/genos-mixer.png"
              alt="SmartBridge Genos Mixer — full keyboard mix on the computer"
              width={900}
              height={560}
              className="w-full object-cover"
            />
            <div className="p-6 border-t border-[var(--color-border)]">
              <p className="text-sm text-stone-400">
                Genos Mixer — balance Style and Song parts, DSP, and ensemble voices from one screen
                while the song chart stays in view.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "Musician-first",
              body: "Designed around how Tyros and Motif players actually write — not generic DAW abstractions.",
            },
            {
              title: "Arrangement-aware",
              body: "Phrases, vocals, and lyrics share one song model instead of scattered files.",
            },
            {
              title: "Production-ready",
              body: "Cubase MIDI Remote, SynthV integration, and export paths built into Setup.",
            },
          ].map((item) => (
            <div key={item.title} className="card-surface p-6">
              <h2 className="font-semibold text-stone-100">{item.title}</h2>
              <p className="mt-2 text-sm prose-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
      <CtaBand />
    </div>
  )
}
