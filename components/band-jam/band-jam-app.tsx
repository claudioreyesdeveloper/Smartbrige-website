"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Pause, Play, Square, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  findPack,
  getBandJamCatalog,
  packIdFor,
  packsFor,
} from "@/lib/band-jam/catalog"
import { StemPlayer } from "@/lib/band-jam/stem-player"
import type { BandPart } from "@/lib/band-jam/types"
import { cn } from "@/lib/utils"

const PARTS: { id: BandPart; label: string }[] = [
  { id: "drums", label: "Drums" },
  { id: "bass", label: "Bass" },
  { id: "guitar", label: "Guitar" },
  { id: "solo", label: "Solo" },
]

const KEYS = [
  { pc: 0, label: "C" },
  { pc: 1, label: "Db" },
  { pc: 2, label: "D" },
  { pc: 3, label: "Eb" },
  { pc: 4, label: "E" },
  { pc: 5, label: "F" },
  { pc: 6, label: "F#" },
  { pc: 7, label: "G" },
  { pc: 8, label: "Ab" },
  { pc: 9, label: "A" },
  { pc: 10, label: "Bb" },
  { pc: 11, label: "B" },
]

export function BandJamApp() {
  const catalog = useMemo(() => getBandJamCatalog(), [])
  const playerRef = useRef<StemPlayer | null>(null)

  const [styleId, setStyleId] = useState(catalog.styles[0]?.id ?? "funk")
  const [progressionId, setProgressionId] = useState(
    catalog.progressions[0]?.id ?? "am7-d9-vamp",
  )
  const style = catalog.styles.find((s) => s.id === styleId) ?? catalog.styles[0]
  const progression =
    catalog.progressions.find((p) => p.id === progressionId) ??
    catalog.progressions[0]

  const [keyPc, setKeyPc] = useState(progression?.keyPc ?? 9)
  const [tempo, setTempo] = useState(
    progression?.tempo ?? style?.tempoDefault ?? 116,
  )
  const [loop, setLoop] = useState(true)
  const [muted, setMuted] = useState<Record<BandPart, boolean>>({
    drums: false,
    bass: false,
    guitar: false,
    solo: true,
  })
  const [status, setStatus] = useState("idle")
  const [error, setError] = useState("")
  const [playhead, setPlayhead] = useState(0)

  const pack = findPack(catalog, {
    styleId,
    progressionId,
    keyPc,
    tempo,
  })

  const availablePacks = useMemo(
    () => packsFor(catalog, styleId, progressionId),
    [catalog, styleId, progressionId],
  )
  const availableKeys = useMemo(
    () => [...new Set(availablePacks.map((p) => p.keyPc))].sort((a, b) => a - b),
    [availablePacks],
  )
  const availableTempos = useMemo(
    () =>
      [...new Set(availablePacks.filter((p) => p.keyPc === keyPc).map((p) => p.tempo))].sort(
        (a, b) => a - b,
      ),
    [availablePacks, keyPc],
  )
  const progressionsWithPacks = useMemo(() => {
    const ids = new Set(
      catalog.packs.filter((p) => p.styleId === styleId).map((p) => p.progressionId),
    )
    return catalog.progressions.filter((p) => ids.has(p.id))
  }, [catalog, styleId])
  const stylesWithPacks = useMemo(() => {
    const ids = new Set(catalog.packs.map((p) => p.styleId))
    return catalog.styles.filter((s) => ids.has(s.id))
  }, [catalog])

  useEffect(() => {
    const player = new StemPlayer()
    player.setStatusListener(setStatus)
    playerRef.current = player
    return () => player.dispose()
  }, [])

  useEffect(() => {
    playerRef.current?.setLoop(loop)
  }, [loop])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      setPlayhead(playerRef.current?.getCurrentTime() ?? 0)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !pack) return
    let cancelled = false
    setError("")
    ;(async () => {
      try {
        await player.load(pack.stems)
        for (const part of PARTS) {
          player.setMuted(part.id, muted[part.id])
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load stems")
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // muted applied after load; don't reload on mute changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack?.packId])

  const onStyleChange = (id: string) => {
    setStyleId(id)
    const nextPacks = packsFor(catalog, id, progressionId)
    if (nextPacks.length === 0) {
      const any = catalog.packs.find((p) => p.styleId === id)
      if (any) {
        setProgressionId(any.progressionId)
        setKeyPc(any.keyPc)
        setTempo(any.tempo)
      }
      return
    }
    const match =
      nextPacks.find((p) => p.keyPc === keyPc && p.tempo === tempo) ?? nextPacks[0]
    setKeyPc(match.keyPc)
    setTempo(match.tempo)
  }

  const onProgressionChange = (id: string) => {
    setProgressionId(id)
    const nextPacks = packsFor(catalog, styleId, id)
    const match = nextPacks[0]
    if (match) {
      setKeyPc(match.keyPc)
      setTempo(match.tempo)
    }
  }

  const toggleMute = (part: BandPart) => {
    setMuted((prev) => {
      const next = { ...prev, [part]: !prev[part] }
      playerRef.current?.setMuted(part, next[part])
      return next
    })
  }

  const togglePlay = async () => {
    const player = playerRef.current
    if (!player || !pack) return
    await player.ensureContext()
    if (status === "playing") player.pause()
    else player.play()
  }

  const stop = () => playerRef.current?.stop()

  const expectedId = packIdFor({ styleId, progressionId, keyPc, tempo })
  const duration = playerRef.current?.getDuration() ?? pack?.durationSeconds ?? 0

  return (
    <div className="relative min-h-[calc(100vh-8rem)] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,rgba(74,158,255,0.18),transparent)]" />
      <div className="content-wrap page-shell relative space-y-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Link
              href="/jam-player"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
            >
              <ArrowLeft className="size-3.5" />
              Jam Player
            </Link>
            <h1 className="font-[family-name:var(--font-instrument-serif)] text-3xl text-slate-50 md:text-4xl">
              Practice with a virtual band
            </h1>
            <p className="max-w-2xl text-sm text-slate-400">
              Mute the instrument you play. Stems are pre-rendered through Yamaha
              PSR-S900 Kontakt instruments (MegaVoice bass/guitar + kit).
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full px-3 py-1 uppercase tracking-wider">
            Pilot
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-5 rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
            <Field label="Style">
              <select
                className="w-full rounded-xl border border-white/12 bg-black/35 px-3.5 py-2.5 text-[0.95rem] text-slate-200"
                value={styleId}
                onChange={(e) => onStyleChange(e.target.value)}
              >
                {(stylesWithPacks.length ? stylesWithPacks : catalog.styles).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Chord progression">
              <select
                className="w-full rounded-xl border border-white/12 bg-black/35 px-3.5 py-2.5 text-[0.95rem] text-slate-200"
                value={progressionId}
                onChange={(e) => onProgressionChange(e.target.value)}
              >
                {(progressionsWithPacks.length
                  ? progressionsWithPacks
                  : catalog.progressions
                ).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.keyLabel})
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Key">
                <select
                  className="w-full rounded-xl border border-white/12 bg-black/35 px-3.5 py-2.5 text-[0.95rem] text-slate-200"
                  value={keyPc}
                  onChange={(e) => {
                    const nextKey = Number(e.target.value)
                    setKeyPc(nextKey)
                    const tempos = availablePacks
                      .filter((p) => p.keyPc === nextKey)
                      .map((p) => p.tempo)
                    if (tempos.length && !tempos.includes(tempo)) setTempo(tempos[0])
                  }}
                >
                  {(availableKeys.length
                    ? KEYS.filter((k) => availableKeys.includes(k.pc))
                    : KEYS
                  ).map((k) => (
                    <option key={k.pc} value={k.pc}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Tempo · ${tempo} BPM`}>
                {availableTempos.length > 1 ? (
                  <select
                    className="w-full rounded-xl border border-white/12 bg-black/35 px-3.5 py-2.5 text-[0.95rem] text-slate-200"
                    value={tempo}
                    onChange={(e) => setTempo(Number(e.target.value))}
                  >
                    {availableTempos.map((t) => (
                      <option key={t} value={t}>
                        {t} BPM
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm text-slate-300">
                    {tempo} BPM
                    {availableTempos.length === 0 ? " (not rendered)" : ""}
                  </p>
                )}
              </Field>
            </div>

            <Field label="You play (muted)">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PARTS.map((part) => {
                  const available = Boolean(pack?.stems[part.id] || style?.parts[part.id])
                  return (
                    <button
                      key={part.id}
                      type="button"
                      disabled={!available}
                      onClick={() => toggleMute(part.id)}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-left text-sm transition",
                        muted[part.id]
                          ? "border-amber-400/50 bg-amber-400/10 text-amber-100"
                          : "border-white/10 bg-white/5 text-slate-200 hover:border-sky-400/40",
                        !available && "opacity-40",
                      )}
                    >
                      <div className="font-medium">{part.label}</div>
                      <div className="text-xs text-slate-400">
                        {muted[part.id] ? "I'll play" : "In the band"}
                      </div>
                    </button>
                  )
                })}
              </div>
            </Field>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
                className="accent-sky-400"
              />
              Loop arrangement
            </label>
          </section>

          <section className="flex flex-col justify-between gap-5 rounded-2xl border border-sky-500/30 bg-black/50 p-5 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="space-y-3">
              <p className="ux-section-label">Playback</p>
              <p className="font-[family-name:var(--font-instrument-serif)] text-2xl text-slate-50">
                {style?.name} · {progression?.name}
              </p>
              <p className="text-sm text-slate-400">
                Pack{" "}
                <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-slate-300">
                  {expectedId}
                </code>
              </p>
              {pack ? (
                <p className="text-sm text-emerald-300/90">
                  Stems ready (PSR-S900 render)
                </p>
              ) : (
                <p className="text-sm text-amber-200/90">
                  Not rendered yet for this style / progression / key / tempo.
                  Run the offline stem renderer, then refresh.
                </p>
              )}
              {error && (
                <p className="text-sm text-rose-300" role="status">
                  {error}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-sky-400 transition-[width] duration-100"
                  style={{
                    width:
                      duration > 0
                        ? `${Math.min(100, (playhead / duration) * 100)}%`
                        : "0%",
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="lg"
                  className="min-h-12 rounded-xl px-6"
                  disabled={!pack || status === "loading"}
                  onClick={() => void togglePlay()}
                >
                  {status === "playing" ? (
                    <>
                      <Pause className="size-4" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="size-4" /> Play
                    </>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-12 rounded-xl px-6"
                  disabled={!pack}
                  onClick={stop}
                >
                  <Square className="size-4" /> Stop
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Status: {status}
                {duration > 0
                  ? ` · ${playhead.toFixed(1)}s / ${duration.toFixed(1)}s`
                  : ""}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  )
}
