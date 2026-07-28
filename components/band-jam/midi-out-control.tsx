"use client"

import { Cable } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UseMidiOutResult } from "@/lib/band-jam/engine/web-midi"

/**
 * Send the arrangement to a real keyboard instead of (or alongside) the
 * browser sampler.
 *
 * This is the same note stream the sampler plays — on a Yamaha arranger the
 * MegaVoice FX notes above 83 hit genuine ROM articulations rather than our
 * converted samples. See docs/jam-player-voice-engine.md section 4.
 *
 * Access must be requested from a user gesture, so the button does that
 * rather than requesting on mount.
 */
export function MidiOutControl({
  midi,
  className,
}: {
  midi: UseMidiOutResult
  className?: string
}) {
  if (!midi.supported) return null

  if (midi.status === "idle" || midi.status === "requesting") {
    return (
      <button
        type="button"
        onClick={() => void midi.requestAccess()}
        disabled={midi.status === "requesting"}
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-xl border border-white/12 bg-black/35 px-3 text-sm text-slate-300 transition-colors hover:border-white/25 disabled:opacity-50",
          className,
        )}
      >
        <Cable className="size-4" aria-hidden="true" />
        {midi.status === "requesting" ? "Connecting…" : "MIDI out"}
      </button>
    )
  }

  if (midi.status === "denied" || midi.status === "error") {
    return (
      <span
        className={cn("text-xs text-amber-300/80", className)}
        role="status"
      >
        MIDI unavailable{midi.error ? ` — ${midi.error}` : ""}
      </span>
    )
  }

  return (
    <div className={cn("flex min-h-11 items-center gap-2", className)}>
      <select
        value={midi.selectedOutputId ?? ""}
        onChange={(e) => midi.selectOutput(e.target.value || null)}
        className="min-h-11 max-w-[42vw] rounded-xl border border-white/12 bg-black/35 px-3 text-sm text-slate-200"
        aria-label="MIDI output device"
      >
        <option value="">No MIDI output</option>
        {midi.outputs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => midi.setEnabled(!midi.enabled)}
        aria-pressed={midi.enabled}
        disabled={!midi.selectedOutputId}
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm transition-colors disabled:opacity-40",
          midi.enabled
            ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
            : "border-white/12 text-slate-400 hover:bg-white/5",
        )}
      >
        <Cable className="size-4" aria-hidden="true" />
        {midi.enabled ? "Sending" : "Send"}
      </button>
    </div>
  )
}
