import type { Metadata } from "next"
import Image from "next/image"
import { CtaBand } from "@/components/cta-band"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "About",
  description:
    "SmartBridge is an independent project built from real musician workflow needs — connecting Yamaha keyboards to modern production. Style Maker is available now; the desktop suite is invitation-only beta.",
}

export default function AboutPage() {
  return (
    <div className="page-shell">
      <div className="content-wrap">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-start">
          <div>
            <p className="ux-section-label">About</p>
            <h1 className="section-title mt-3">Built from real workflow friction</h1>
            <div className="mt-6 space-y-4 prose-muted">
              <p>
                SmartBridge started as a practical answer to a problem many Yamaha keyboard
                musicians know: the gap between generating ideas on the hardware and finishing
                arrangements on the computer.
              </p>
              <p>
                SmartBridge is an independent project created by Claudio Reyes from his own
                real-world songwriting and production workflow. It began as a personal tool — built
                to connect Yamaha keyboards, musical ideas, arrangement work, vocals, and DAW
                production in a more natural way.
              </p>
              <p>
                Over the past six months, it has grown into a substantial platform shaped through
                daily studio use, testing, refinement, and a significant amount of custom
                development. The current codebase reflects the depth of that work across keyboard
                integration, arrangement tools, chord workflows, phrase generation, lyrics, vocals,
                and production features.
              </p>
              <p>
                SmartBridge is not a mass-market product and it is not affiliated with Yamaha
                Corporation. It is a serious independent build, created with care, experience, and
                long-term commitment. Claudio now wants to share it with other musicians who work
                in a similar way and who can see the value of a tool developed from real musical
                practice.
              </p>
            </div>
            <a href={`mailto:${SITE.email}`} className="mt-8 inline-flex btn-secondary">
              Get in touch
            </a>
          </div>

          <div className="card-surface overflow-hidden">
            <Image
              src="/images/claudio-reyes-studio.jpg"
              alt="Claudio Reyes in the studio working on SmartBridge"
              width={900}
              height={1200}
              className="w-full object-cover"
            />
            <div className="p-6 border-t border-[var(--color-border)]">
              <p className="text-sm text-stone-400">
                Claudio Reyes building SmartBridge from real keyboard, arranging, and production
                sessions in his own studio.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "Musician-first",
              body: "Designed around how Tyros, Genos, and Motif players actually write — not generic DAW abstractions.",
            },
            {
              title: "Arrangement-aware",
              body: "Phrases, vocals, lyrics, and chord sections share one connected song model instead of scattered files.",
            },
            {
              title: "Independent",
              body: "Built first for Claudio’s own personal use over about six months, then shared with other keyboard musicians — Style Maker is available now; the full desktop suite remains invitation-only beta.",
            },
          ].map((item) => (
            <div key={item.title} className="card-surface p-6">
              <h2 className="font-semibold text-stone-100">{item.title}</h2>
              <p className="mt-2 text-sm prose-muted">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <p className="section-label">Effort behind SmartBridge</p>
          <h2 className="section-title mt-3" style={{ fontSize: "1.5rem" }}>Built over months, not weekends</h2>
          <p className="prose-muted mt-4" style={{ maxWidth: "52rem" }}>
            Based on the current SmartBridge source snapshot, the project already spans a large
            amount of custom code across core logic, UI, keyboard integration, lyrics, Jam Player,
            Jam Session, and production workflows.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Development time", value: "~6 months" },
              { label: "Source files", value: "338" },
              { label: "Total lines", value: "~166k" },
            ].map((item) => (
              <div key={item.label} className="card-surface p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-stone-100">{item.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-stone-500">
            Source snapshot measured from the provided SmartBridge codebase: 158 C++ source files and 180 header files.
          </p>
        </div>
      </div>
      <CtaBand />
    </div>
  )
}
