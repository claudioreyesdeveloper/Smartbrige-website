"use client"

import { Check, RotateCcw, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import { PART_META } from "@/components/band-jam/band-strip"
import {
  ARRANGER_SECTION_ROLES,
  type StyleArrangerState,
} from "@/lib/band-jam/engine/style-arranger"
import type { BandPart, SectionRole } from "@/lib/band-jam/engine/types"

const ROLE_LABELS: Record<SectionRole, string> = {
  intro: "Intro",
  verse: "Verse",
  pre_chorus: "Pre-Chorus",
  chorus: "Chorus",
  bridge: "Bridge",
  outro: "Outro",
  section: "Other sections",
}

export type ArrangerPanelProps = {
  styleLabel: string
  parts: BandPart[]
  variationCount: number
  variation: number
  state: StyleArrangerState
  onVariation: (variation: number) => void
  onToggle: (variation: number, role: SectionRole, part: BandPart) => void
  onSection: (variation: number, role: SectionRole, enabled: boolean) => void
  onReset: () => void
  onSave: () => void
  isDirty?: boolean
  justSaved?: boolean
}

export function ArrangerPanel({
  styleLabel,
  parts,
  variationCount,
  variation,
  state,
  onVariation,
  onToggle,
  onSection,
  onReset,
  onSave,
  isDirty = false,
  justSaved = false,
}: ArrangerPanelProps) {
  const plan = state[variation] ?? state[0]
  if (!plan) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-3 sm:p-4" role="group" aria-label="Style arranger">
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        <div className="mr-2">
          <p className="text-sm font-semibold text-white">{styleLabel} arranger</p>
          <p className="text-[10px] text-white/35">
            Choose the instruments in every section. A–D each keep their own arrangement.
          </p>
        </div>

        <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1" aria-label="Arrangement variation">
          {Array.from({ length: variationCount }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onVariation(index)}
              aria-pressed={variation === index}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg text-xs font-semibold transition",
                variation === index
                  ? "bg-orange-400 text-black"
                  : "text-white/40 hover:bg-white/5 hover:text-white/80",
              )}
            >
              {String.fromCharCode(65 + index)}
            </button>
          ))}
        </div>

        <button type="button" onClick={onReset} className="ml-auto flex h-10 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs text-white/55 transition hover:bg-white/5 hover:text-white">
          <RotateCcw className="size-3.5" /> Reset
        </button>
        <button
          type="button"
          onClick={onSave}
          className={cn(
            "flex h-10 min-w-[148px] items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold transition",
            justSaved
              ? "bg-emerald-500 text-black"
              : isDirty
                ? "bg-orange-400 text-black hover:bg-orange-300"
                : "border border-white/10 bg-white/5 text-white/55",
          )}
        >
          {justSaved ? <Check className="size-4" /> : <Save className="size-4" />}
          {justSaved ? "Saved" : "Save arrangement"}
        </button>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[720px]">
          <div
            className="mb-2 grid gap-2"
            style={{ gridTemplateColumns: `170px repeat(${parts.length}, minmax(112px, 1fr))` }}
          >
            <div className="px-3 py-2 text-[10px] font-semibold tracking-[0.14em] text-white/25 uppercase">Song section</div>
            {parts.map((part) => {
              const meta = PART_META[part]
              const Icon = meta.icon
              return (
                <div key={part} className="flex items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-xs font-semibold text-white/65">
                  <Icon className="size-4 text-orange-200" />
                  {meta.label}
                </div>
              )
            })}
          </div>

          <div className="space-y-2">
            {ARRANGER_SECTION_ROLES.map((role) => {
              const enabledCount = parts.filter((part) => plan[role][part]).length
              return (
                <div
                  key={role}
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `170px repeat(${parts.length}, minmax(112px, 1fr))` }}
                >
                  <div className="flex items-center rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white/75">{ROLE_LABELS[role]}</p>
                      <p className="text-[9px] text-white/25">{enabledCount} playing</p>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => onSection(variation, role, true)} className="rounded-md border border-white/10 px-1.5 py-1 text-[8px] font-semibold text-white/35 hover:text-white">ALL</button>
                      <button type="button" onClick={() => onSection(variation, role, false)} className="rounded-md border border-white/10 px-1.5 py-1 text-[8px] font-semibold text-white/35 hover:text-white">NONE</button>
                    </div>
                  </div>
                  {parts.map((part) => {
                    const enabled = plan[role][part]
                    return (
                      <button
                        key={part}
                        type="button"
                        onClick={() => onToggle(variation, role, part)}
                        aria-pressed={enabled}
                        className={cn(
                          "flex min-h-14 items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition",
                          enabled
                            ? "border-orange-300/45 bg-orange-400/12 text-orange-100"
                            : "border-white/7 bg-black/35 text-white/20 hover:border-white/15 hover:text-white/40",
                        )}
                      >
                        <span className={cn("size-2 rounded-full", enabled ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" : "bg-white/10")} />
                        {enabled ? "Playing" : "Silent"}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
