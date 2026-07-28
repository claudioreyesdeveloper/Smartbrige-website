"use client"

import Link from "next/link"
import { ArrowRight, Headphones, Music2, VolumeX } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const steps = [
  {
    title: "Pick a style and progression",
    body: "Start from curated chord progressions and three band styles built from SmartBridge libraries.",
    icon: Music2,
  },
  {
    title: "Mute the part you play",
    body: "Drums, bass, guitar, or solo — leave your instrument out and keep the rest of the band.",
    icon: VolumeX,
  },
  {
    title: "Practise with real band sound",
    body: "Stems are pre-rendered through Yamaha PSR-S900 Kontakt instruments, not a generic SoundFont.",
    icon: Headphones,
  },
]

export function BandJamLanding() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(74,158,255,0.22),transparent)]" />
      <div className="content-wrap page-shell relative">
        <section className="grid items-center gap-12 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div className="space-y-7">
            <p className="ux-section-label">New pilot</p>
            <Badge
              variant="secondary"
              className="rounded-full px-3 py-1 text-[0.7rem] tracking-[0.14em] uppercase"
            >
              Practice · not a backing-track player
            </Badge>
            <h1 className="font-[family-name:var(--font-instrument-serif)] text-5xl leading-[1.05] tracking-[-0.03em] text-slate-50 md:text-6xl">
              Jam Player
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-400">
              Practise with a configurable virtual band built from SmartBridge&apos;s
              existing drum, bass, and guitar libraries — mute your instrument and play along.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/jam-player/app"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "min-h-12 rounded-xl px-7 text-base",
                )}
              >
                Open Jam Player
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          <Card className="premium-card border-sky-500/40 bg-black/60 shadow-2xl shadow-black/40 backdrop-blur">
            <CardHeader className="space-y-3 p-7">
              <CardTitle className="font-[family-name:var(--font-instrument-serif)] text-3xl font-normal">
                Pilot scope
              </CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Small on purpose — prove that musicians come back because they can
                choose a progression, mute their part, and play with a complete band.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-7 pt-0 text-sm text-slate-300">
              <p>3 styles · ~25 progressions · key &amp; tempo · loop · part mute</p>
              <p>Audio from pre-rendered PSR-S900 Kontakt stems</p>
              <p>No editing · no AI · no new musical libraries</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 pb-16 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.title} className="border-white/10 bg-black/35">
              <CardHeader className="space-y-3">
                <step.icon className="size-5 text-sky-400" />
                <CardTitle className="text-lg">{step.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed text-slate-400">
                  {step.body}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </div>
    </div>
  )
}
