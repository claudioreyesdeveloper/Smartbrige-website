import type { Metadata } from "next"
import Link from "next/link"
import { Download, Mail, KeyRound, Monitor } from "lucide-react"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Beta access",
  description:
    "Request SmartBridge beta access or download Setup for Demo and Beta installers for macOS and Windows.",
}

const STEPS = [
  {
    icon: Download,
    title: "Download SmartBridge Setup",
    body: "Pick Demo (30-day trial) or Beta 0.1 (email + serial) for your platform.",
    href: SITE.setupUrl,
    external: true,
  },
  {
    icon: Monitor,
    title: "Install components",
    body: "Setup installs the plugin, phrase library, Cubase scripts, SynthV side panel, and optional drivers.",
    href: SITE.setupUrl,
    external: true,
  },
  {
    icon: KeyRound,
    title: "Beta activation",
    body: "Beta builds prompt for your email and serial on first install. Request access below if you need a serial.",
    href: `mailto:${SITE.email}?subject=SmartBridge%20Beta%20Access%20Request`,
    external: true,
  },
]

export default function BetaPage() {
  return (
    <div className="page-shell">
      <div className="content-wrap">
        <p className="ux-section-label">Beta program</p>
        <h1 className="section-title mt-3">Get SmartBridge on your machine</h1>
        <p className="mt-4 max-w-xl prose-muted" style={{ lineHeight: 1.55 }}>
          Invitation-only beta for the full desktop SmartBridge suite. Setup downloads the
          plugin, database, and integration scripts — then you activate and play.
        </p>

        <div className="mt-8 rounded-xl border border-sky-500/30 bg-sky-500/10 p-6">
          <p className="font-medium text-stone-100">Want something available today?</p>
          <p className="mt-2 prose-muted text-sm" style={{ lineHeight: 1.55 }}>
            Style Maker is live now with a 14-day free trial — rebuild Yamaha styles in the
            browser, independent of the desktop beta.
          </p>
          <Link href="/style-maker" className="btn-primary mt-4">
            Start Style Maker free trial
          </Link>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon
            const className = "card-surface p-7 flex flex-col h-full min-h-[14rem]"
            const inner = (
              <>
                <Icon size={22} className="text-[var(--color-accent)]" />
                <h2 className="mt-4 font-semibold text-stone-100">{step.title}</h2>
                <p className="mt-2 text-sm prose-muted flex-1">{step.body}</p>
                <span className="mt-4 text-sm text-[var(--color-accent)]">Learn more →</span>
              </>
            )
            return step.external ? (
              <a
                key={step.title}
                href={step.href}
                className={className}
                target="_blank"
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            ) : (
              <Link key={step.title} href={step.href} className={className}>
                {inner}
              </Link>
            )
          })}
        </div>

        <div className="mt-12 card-surface p-8 md:p-10">
          <div className="flex items-start gap-4">
            <Mail size={24} className="text-[var(--color-accent)] shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-semibold text-stone-50">Request beta access</h2>
              <p className="mt-3 prose-muted max-w-2xl">
                Email Claudio with your name, Yamaha keyboard model, and DAW. You&apos;ll receive
                download instructions and a beta serial for the Setup installer.
              </p>
              <a href={`mailto:${SITE.email}?subject=SmartBridge%20Beta%20Access%20Request`} className="btn-primary mt-6">
                Email {SITE.email}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 text-sm text-stone-400">
          <p className="font-medium text-stone-300">Flavors</p>
          <ul className="mt-3 space-y-2">
            <li>
              <strong className="text-stone-200">Demo</strong> — 30-day timer from first launch.
              No serial required.
            </li>
            <li>
              <strong className="text-stone-200">Beta 0.1</strong> — Full access with email +
              serial activation.
            </li>
          </ul>
          <p className="mt-4">
            Both flavors install side-by-side with distinct bundle identifiers. Pick the one that
            matches how you were invited.
          </p>
        </div>
      </div>
    </div>
  )
}
