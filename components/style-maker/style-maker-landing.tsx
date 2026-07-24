"use client"

import { ArrowRight, Check, Guitar, Music2, SlidersHorizontal, Upload } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SITE } from "@/lib/site"
import { cn } from "@/lib/utils"

const steps = [
  {
    step: "01",
    title: "Import a donor style",
    body: "Open a Yamaha style and keep its CASM and OTS intact. You rebuild the musical parts without losing the style’s structure.",
    icon: Upload,
  },
  {
    step: "02",
    title: "Browse, audition, assign",
    body: "Filter the bass and drum library, hear clips against your style, then drop the winners onto each section lane.",
    icon: Music2,
  },
  {
    step: "03",
    title: "Mix, export, transfer",
    body: "Balance channels 9–16 per section, export a native style file, and send it over USB to USER:\\STYLE like desktop SmartBridge.",
    icon: SlidersHorizontal,
  },
]

const included = [
  "Bass and drum phrase library",
  "Custom MIDI upload per lane",
  "Per-section Style Part Mixer (ch 9–16)",
  "CASM-aware native style export",
  "USB Musicsoft transfer to USER:\\STYLE",
  "Works with Genos, Tyros, and compatible arrangers",
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
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(74,158,255,0.22),transparent)]" />
      <div className="content-wrap page-shell relative">
        <section className="grid items-center gap-12 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div className="space-y-7">
            <p className="ux-section-label">Available now</p>
            <Badge
              variant="secondary"
              className="rounded-full px-3 py-1 text-[0.7rem] tracking-[0.14em] uppercase"
            >
              14-day free trial · then $14.99/mo
            </Badge>
            <h1 className="font-[family-name:var(--font-instrument-serif)] text-5xl leading-[1.05] tracking-[-0.03em] text-slate-50 md:text-6xl">
              Style Maker
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-400">
              Rebuild Yamaha arranger styles with SmartBridge bass and drum phrases — or your
              own MIDI — then export and transfer to Genos, Tyros, and compatible keyboards.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="min-h-12 rounded-xl px-7 text-base"
                onClick={startCheckout}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? "Opening checkout…" : "Start free trial"}
                <ArrowRight className="size-4" />
              </Button>
              <Link
                href="/sign-in?redirect_url=/style-maker/app"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "min-h-12 rounded-xl px-7 text-base",
                )}
              >
                Sign in
              </Link>
              <Link
                href="/style-maker/app"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "min-h-12 rounded-xl px-7 text-base",
                )}
              >
                Open app
                <Guitar className="size-4" />
              </Link>
            </div>
            {notice && (
              <p className="text-sm text-rose-300" role="status">
                {notice}
              </p>
            )}
          </div>

          <Card className="premium-card border-sky-500/40 bg-black/60 shadow-2xl shadow-black/40 backdrop-blur">
            <CardHeader className="space-y-3 p-7">
              <CardTitle className="font-[family-name:var(--font-instrument-serif)] text-3xl font-normal">
                Style Maker subscription
              </CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Standalone access to Style Maker and the phrase library — independent of the
                full desktop SmartBridge suite.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-7 pt-0">
              <div className="flex items-end gap-2">
                <span className="font-[family-name:var(--font-instrument-serif)] text-5xl text-slate-50">
                  $14.99
                </span>
                <span className="pb-2 text-slate-400">/ month</span>
              </div>
              <p className="text-sm text-slate-400">
                14-day free trial. Card required at signup — first charge after the trial.
              </p>
              <ul className="space-y-3.5">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[0.95rem] text-slate-300">
                    <Check className="mt-0.5 size-4 shrink-0 text-sky-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="min-h-12 w-full rounded-xl text-base"
                size="lg"
                onClick={startCheckout}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? "Opening checkout…" : "Start 14-day free trial"}
              </Button>
              <p className="text-center text-xs text-slate-500">
                Then $14.99/month. Cancel anytime. Requires a supported Yamaha arranger for
                transfer and audition. Currently desktop Chrome or Edge with USB.
              </p>
            </CardContent>
          </Card>
        </section>

        <p className="mb-10 max-w-2xl text-sm leading-relaxed text-slate-500">
          iOS and Android support may come later. For updates or to discuss mobile needs,
          contact{" "}
          <a
            href={`mailto:${SITE.email}?subject=${encodeURIComponent("Style Maker iOS / Android")}`}
            className="text-sky-400 underline-offset-2 hover:underline"
          >
            {SITE.email}
          </a>
          .
        </p>

        <section className="space-y-8 pb-24">
          <div>
            <p className="ux-section-label">How it works</p>
            <h2 className="mt-3 font-[family-name:var(--font-instrument-serif)] text-3xl text-slate-50 md:text-4xl">
              Three clear stages
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((feature) => (
              <Card
                key={feature.title}
                className="premium-card border-sky-500/40 bg-black/50 min-h-[14rem]"
              >
                <CardHeader className="space-y-4 p-7">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex size-12 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
                      <feature.icon className="size-5" />
                    </div>
                    <span className="text-xs font-bold tracking-[0.16em] text-slate-500">
                      {feature.step}
                    </span>
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="leading-relaxed text-[0.98rem]">
                    {feature.body}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
