"use client"

import { useState } from "react"
import { SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BandPart } from "@/lib/band-jam/engine/types"
import type { StyleEffectPreset } from "@/lib/band-jam/engine/effects"
import { PART_META } from "@/components/band-jam/band-strip"

/**
 * Mix controls.
 *
 * The single most important control here is BYPASS: without an A/B you cannot
 * judge whether the processing is helping, and the presets are convention-based
 * starting values that need exactly that judgement.
 *
 * Everything else is deliberately shallow — this is a practice tool, not a
 * mixing desk. Reverb amount and per-part sends cover what a musician actually
 * reaches for; EQ and compression stay in the preset where they belong.
 */

export type EffectsControlProps = {
  preset: StyleEffectPreset | null
  bypassed: boolean
  onBypass: (b: boolean) => void
  reverbWet: number
  onReverbWet: (v: number) => void
  parts: BandPart[]
  sends: Partial<Record<BandPart, number>>
  onSend: (part: BandPart, v: number) => void
  className?: string
}

export function EffectsControl({
  preset,
  bypassed,
  onBypass,
  reverbWet,
  onReverbWet,
  parts,
  sends,
  onSend,
  className,
}: EffectsControlProps) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm transition-colors",
          bypassed
            ? "border-white/12 text-slate-500 hover:bg-white/5"
            : "border-sky-400/50 bg-sky-500/10 text-sky-200",
          className,
        )}
        aria-label="Mix and effects"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {bypassed ? "FX off" : (preset?.label ?? "FX")}
      </button>
    )
  }

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-sky-500/30 bg-black/70 p-3 backdrop-blur",
        className,
      )}
      role="group"
      aria-label="Mix and effects"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm text-slate-200">
          {preset?.label ?? "Mix"}
          {preset ? (
            <span className="ml-2 text-xs text-slate-500">{preset.id}</span>
          ) : null}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onBypass(!bypassed)}
            aria-pressed={!bypassed}
            className={cn(
              "min-h-9 rounded-lg px-3 text-xs transition-colors",
              bypassed
                ? "bg-white/5 text-slate-400"
                : "bg-sky-500 text-white",
            )}
          >
            {bypassed ? "Bypassed" : "Active"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-100"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        Bypass to A/B against the raw samples.
      </p>

      <label className="mb-3 flex items-center gap-3 text-xs text-slate-400">
        <span className="w-20 shrink-0">Reverb</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(reverbWet * 100)}
          onChange={(e) => onReverbWet(Number(e.target.value) / 100)}
          disabled={bypassed}
          className="flex-1 accent-sky-400 disabled:opacity-40"
          aria-label="Reverb amount"
        />
        <span className="w-8 text-right tabular-nums">
          {Math.round(reverbWet * 100)}
        </span>
      </label>

      <div className="space-y-1.5 border-t border-white/10 pt-2">
        <p className="text-[10px] tracking-wider text-slate-500 uppercase">
          Reverb send
        </p>
        {parts.map((part) => (
          <label
            key={part}
            className="flex items-center gap-3 text-xs text-slate-400"
          >
            <span className="w-20 shrink-0">{PART_META[part].label}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round((sends[part] ?? 0) * 100)}
              onChange={(e) => onSend(part, Number(e.target.value) / 100)}
              disabled={bypassed}
              className="flex-1 accent-sky-400 disabled:opacity-40"
              aria-label={`${PART_META[part].label} reverb send`}
            />
            <span className="w-8 text-right tabular-nums">
              {Math.round((sends[part] ?? 0) * 100)}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
