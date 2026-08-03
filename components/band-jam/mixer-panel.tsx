"use client"

import { useState } from "react"
import { Check, Headphones, RotateCcw, Save, Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"
import { BAND_FIGURES } from "@/components/band-jam/band-figures"
import { ChannelFader } from "@/components/band-jam/channel-fader"
import { PART_META } from "@/components/band-jam/band-strip"
import type { UserEqSettings } from "@/lib/band-jam/engine/effects"
import type { BandPart, PartMixState } from "@/lib/band-jam/engine/types"

type EqBandName = keyof UserEqSettings

export type MixerPanelProps = {
  parts: BandPart[]
  mix: Record<BandPart, PartMixState>
  userPart: BandPart | null
  onPickUserPart: (part: BandPart | null) => void
  onToggleMute: (part: BandPart) => void
  soloed: BandPart | null
  onToggleSolo: (part: BandPart) => void
  onVolume: (part: BandPart, volume: number) => void
  eq: Record<BandPart, UserEqSettings>
  onEq: (part: BandPart, band: EqBandName, value: number) => void
  sends: Record<BandPart, number>
  onSend: (part: BandPart, value: number) => void
  pan: Record<BandPart, number>
  onPan: (part: BandPart, value: number) => void
  room: number
  onRoom: (value: number) => void
  styleLabel?: string
  onReset?: () => void
  onSave?: () => void
  isDirty?: boolean
  justSaved?: boolean
  className?: string
  variant?: "full" | "compact"
}

const EQ_LABELS: Record<EqBandName, string> = {
  low: "Low",
  mid: "Mid",
  high: "High",
}

const dbLabel = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)} dB`

export function MixerPanel({
  parts,
  mix,
  onToggleMute,
  soloed,
  onToggleSolo,
  onVolume,
  eq,
  onEq,
  sends,
  onSend,
  pan,
  onPan,
  room,
  onRoom,
  styleLabel,
  onReset,
  onSave,
  isDirty = false,
  justSaved = false,
  className,
  variant = "full",
}: MixerPanelProps) {
  const [auditionMode, setAuditionMode] = useState<"listen" | "exclude">("listen")

  if (variant === "compact") {
    const excludedParts = parts.filter((part) => mix[part]?.muted)
    return (
      <div className={cn("min-w-0", className)} role="group" aria-label="Part audition">
        <div className="mb-2 flex items-center gap-2 px-1">
          <div className="flex rounded-lg border border-white/10 bg-black/30 p-0.5" role="group" aria-label="Audition mode">
            <button
              type="button"
              onClick={() => setAuditionMode("listen")}
              aria-pressed={auditionMode === "listen"}
              className={cn(
                "rounded-md px-2.5 py-2 text-[9px] font-semibold tracking-wide uppercase transition",
                auditionMode === "listen" ? "bg-orange-400 text-black" : "text-white/40 hover:text-white/70",
              )}
            >
              Listen only
            </button>
            <button
              type="button"
              onClick={() => setAuditionMode("exclude")}
              aria-pressed={auditionMode === "exclude"}
              className={cn(
                "rounded-md px-2.5 py-2 text-[9px] font-semibold tracking-wide uppercase transition",
                auditionMode === "exclude" ? "bg-rose-400 text-black" : "text-white/40 hover:text-white/70",
              )}
            >
              Exclude
            </button>
          </div>
          <span className="text-[9px] text-white/30">
            {auditionMode === "listen" ? "Hear one part alone" : "Remove one or more parts"}
          </span>
          {auditionMode === "listen" && soloed ? (
            <button
              type="button"
              onClick={() => onToggleSolo(soloed)}
              className="ml-auto rounded-md border border-orange-300/30 px-2 py-1 text-[9px] text-orange-200"
            >
              Hear full band
            </button>
          ) : auditionMode === "exclude" && excludedParts.length ? (
            <button
              type="button"
              onClick={() => excludedParts.forEach((part) => onToggleMute(part))}
              className="ml-auto rounded-md border border-rose-300/30 px-2 py-1 text-[9px] text-rose-200"
            >
              Restore all
            </button>
          ) : null}
        </div>
        {/* auto-fit, not `repeat(parts.length, …)`: five parts need 462px and the
            compact dock column can be narrower than that, so let them wrap. */}
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(86px, 1fr))" }}>
          {parts.map((part) => {
            const meta = PART_META[part]
            const Figure = BAND_FIGURES[part]
            const excluded = mix[part]?.muted ?? false
            const active = auditionMode === "listen" ? soloed === part : excluded
            const dimmed = auditionMode === "listen" ? soloed !== null && !active : excluded
            return (
              <button
                key={part}
                type="button"
                onClick={() => auditionMode === "listen" ? onToggleSolo(part) : onToggleMute(part)}
                aria-pressed={active}
                aria-label={
                  auditionMode === "listen"
                    ? active
                      ? `Return to full band from ${meta.label}`
                      : `Listen only to ${meta.label}`
                    : excluded
                      ? `Restore ${meta.label} to the band`
                      : `Exclude ${meta.label} from the band`
                }
                className={cn(
                  "group relative flex h-[78px] min-w-0 items-end justify-center overflow-hidden rounded-xl border bg-[#0d0d0d] px-2 pb-5 transition",
                  auditionMode === "listen" && active
                    ? "border-orange-300/70 bg-orange-400/10"
                    : auditionMode === "exclude" && excluded
                      ? "border-rose-300/70 bg-rose-400/10"
                      : auditionMode === "exclude"
                        ? "border-white/10 hover:border-rose-300/35"
                        : "border-white/10 hover:border-orange-300/35",
                )}
              >
                <Figure className={cn("h-14 w-16 transition", auditionMode === "exclude" && excluded ? "text-rose-200/30" : active ? "text-orange-200" : dimmed ? "text-white/10" : "text-orange-300/65 group-hover:text-orange-200")} />
                {auditionMode === "exclude" && excluded ? <VolumeX className="absolute top-2 right-2 size-3.5 text-rose-200" /> : null}
                <span className={cn("absolute inset-x-1 bottom-1.5 truncate text-center text-[9px] tracking-[0.12em] uppercase", auditionMode === "exclude" && excluded ? "text-rose-100" : active ? "text-orange-100" : "text-white/40")}>
                  {auditionMode === "listen" && active
                    ? `Listening · ${meta.label}`
                    : auditionMode === "exclude" && excluded
                      ? `Excluded · ${meta.label}`
                      : meta.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-[#0a0a0a] p-3 sm:p-4", className)} role="group" aria-label="Full style mixer">
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        <div>
          <p className="text-sm font-semibold text-white">{styleLabel ?? "Style"} mixer</p>
          <p className="text-[10px] text-white/35">Changes are live. Press Save to remember them for this style and variation.</p>
        </div>
        <label className="ml-auto flex min-w-[190px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-white/45">
          <span>Reverb return</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(room * 100)}
            onChange={(event) => onRoom(Number(event.target.value) / 100)}
            className="min-w-0 flex-1 accent-sky-400"
            aria-label="Master room reverb"
          />
          <span className="w-8 text-right tabular-nums">{Math.round(room * 100)}%</span>
        </label>
        {onReset ? (
          <button type="button" onClick={onReset} className="flex h-10 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs text-white/55 transition hover:bg-white/5 hover:text-white">
            <RotateCcw className="size-3.5" /> Reset
          </button>
        ) : null}
        {onSave ? (
          <button
            type="button"
            onClick={onSave}
            className={cn(
              "flex h-10 min-w-[122px] items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold transition",
              justSaved
                ? "bg-emerald-500 text-black"
                : isDirty
                  ? "bg-orange-400 text-black hover:bg-orange-300"
                  : "border border-white/10 bg-white/5 text-white/55",
            )}
          >
            {justSaved ? <Check className="size-4" /> : <Save className="size-4" />}
            {justSaved ? "Saved" : "Save variation mix"}
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[760px] gap-3" style={{ gridTemplateColumns: `repeat(${parts.length}, minmax(142px, 1fr))` }}>
          {parts.map((part) => {
            const meta = PART_META[part]
            const Icon = meta.icon
            const state = mix[part] ?? { volume: 1, muted: false }
            const channelEq = eq[part] ?? { low: 0, mid: 0, high: 0 }
            return (
              <section key={part} className={cn("min-w-0 rounded-2xl border p-3", state.muted ? "border-white/5 bg-black/40 opacity-60" : soloed === part ? "border-sky-300/50 bg-sky-400/[0.06]" : "border-white/10 bg-white/[0.025]")}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-orange-400/10 text-orange-200"><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/80">{meta.label}</span>
                  <button type="button" onClick={() => onToggleMute(part)} aria-pressed={state.muted} className={cn("flex size-8 items-center justify-center rounded-lg border text-[10px] font-bold", state.muted ? "border-red-400/40 bg-red-400/15 text-red-200" : "border-white/10 text-white/35")} aria-label={`${state.muted ? "Unmute" : "Mute"} ${meta.label}`}>
                    {state.muted ? <VolumeX className="size-3.5" /> : "M"}
                  </button>
                  <button type="button" onClick={() => onToggleSolo(part)} aria-pressed={soloed === part} className={cn("flex size-8 items-center justify-center rounded-lg border", soloed === part ? "border-sky-300/50 bg-sky-400/15 text-sky-200" : "border-white/10 text-white/35")} aria-label={`${soloed === part ? "Unsolo" : "Solo"} ${meta.label}`}>
                    <Headphones className="size-3.5" />
                  </button>
                </div>

                <div className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-black/25 py-2">
                  <ChannelFader value={state.volume} onChange={(value) => onVolume(part, value)} label={`${meta.label} volume`} disabled={state.muted} className="h-32 w-11" />
                  <div className="text-center">
                    <Volume2 className="mx-auto mb-1 size-3.5 text-white/30" />
                    <span className="text-[10px] tabular-nums text-white/55">{Math.round(state.volume * 100)}%</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {(Object.keys(EQ_LABELS) as EqBandName[]).map((band) => (
                    <label key={band} className="block">
                      <span className="mb-1 flex justify-between text-[9px] text-white/40"><span>{EQ_LABELS[band]}</span><span className="tabular-nums">{dbLabel(channelEq[band])}</span></span>
                      <input type="range" min={-12} max={12} step={0.5} value={channelEq[band]} onChange={(event) => onEq(part, band, Number(event.target.value))} className="block w-full accent-orange-400" aria-label={`${meta.label} ${EQ_LABELS[band]} EQ`} />
                    </label>
                  ))}

                  <label className="block border-t border-white/8 pt-2.5">
                    <span className="mb-1 flex justify-between text-[9px] text-white/40"><span>Pan</span><span className="tabular-nums">{Math.abs(Math.round((pan[part] ?? 0) * 100)) === 0 ? "C" : `${pan[part] < 0 ? "L" : "R"}${Math.abs(Math.round(pan[part] * 100))}`}</span></span>
                    <input type="range" min={-100} max={100} value={Math.round((pan[part] ?? 0) * 100)} onChange={(event) => onPan(part, Number(event.target.value) / 100)} className="block w-full accent-sky-400" aria-label={`${meta.label} pan`} />
                  </label>
                  <label className="block">
                    <span className="mb-1 flex justify-between text-[9px] text-white/40"><span>Reverb send</span><span className="tabular-nums">{Math.round((sends[part] ?? 0) * 100)}%</span></span>
                    <input type="range" min={0} max={100} value={Math.round((sends[part] ?? 0) * 100)} onChange={(event) => onSend(part, Number(event.target.value) / 100)} className="block w-full accent-sky-400" aria-label={`${meta.label} reverb send`} />
                  </label>
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
