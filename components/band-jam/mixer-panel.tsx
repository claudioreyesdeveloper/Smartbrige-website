"use client"

import { Headphones, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"
import { BAND_FIGURES } from "@/components/band-jam/band-figures"
import { ChannelFader } from "@/components/band-jam/channel-fader"
import { PART_META } from "@/components/band-jam/band-strip"
import type { BandPart, PartMixState } from "@/lib/band-jam/engine/types"

/**
 * The mixer, as the band.
 *
 * Three rows per channel, straight from the reference: the musician, a fader,
 * and the instrument chip. The figure carries the channel's state — lit when
 * playing, dimmed when muted, dashed outline when it is the part you play — so
 * the mix is legible from across the room, which matters when this is propped
 * on a music stand.
 *
 * Tapping a musician takes their part over ("you're the missing piece", the
 * same idea the old band strip had). Muting is on the chip beneath, so the two
 * gestures cannot be confused — that ambiguity was the pilot's main complaint.
 */

export type MixerPanelProps = {
  parts: BandPart[]
  mix: Record<BandPart, PartMixState>
  userPart: BandPart | null
  onPickUserPart: (part: BandPart | null) => void
  onToggleMute: (part: BandPart) => void
  soloed: BandPart | null
  onToggleSolo: (part: BandPart) => void
  onVolume: (part: BandPart, volume: number) => void
  className?: string
  variant?: "full" | "compact"
}

export function MixerPanel({
  parts,
  mix,
  userPart,
  onPickUserPart,
  onToggleMute,
  soloed,
  onToggleSolo,
  onVolume,
  className,
  variant = "full",
}: MixerPanelProps) {
  if (variant === "compact") {
    return (
      <div
        className={cn("grid gap-2", className)}
        style={{ gridTemplateColumns: `repeat(${parts.length}, minmax(92px, 1fr))` }}
        role="group"
        aria-label="Band mixer"
      >
        {parts.map((part) => {
          const meta = PART_META[part]
          const Icon = meta.icon
          const Figure = BAND_FIGURES[part]
          const state = mix[part] ?? { volume: 1, muted: false }
          const isUser = userPart === part
          const silenced = state.muted || (soloed !== null && soloed !== part)
          return (
            <article
              key={part}
              className={cn(
                "relative overflow-hidden rounded-xl border bg-[#0d0d0d] p-2 transition",
                isUser ? "border-dashed border-orange-300/60" : "border-white/10",
              )}
            >
              <button
                type="button"
                onClick={() => onPickUserPart(isUser ? null : part)}
                className="group flex h-14 w-full items-end justify-center"
                aria-pressed={isUser}
                aria-label={isUser ? `Return ${meta.label} to band` : `Play ${meta.label} yourself`}
              >
                <Figure
                  className={cn(
                    "h-14 w-16 transition",
                    isUser
                      ? "text-orange-300/25"
                      : silenced
                        ? "text-white/10"
                        : "text-orange-300/80 group-hover:text-orange-200",
                  )}
                />
                {isUser ? (
                  <span className="absolute top-2 right-2 rounded bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-black uppercase">
                    You
                  </span>
                ) : null}
              </button>
              <div className="mt-1 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onToggleMute(part)}
                  disabled={isUser}
                  aria-pressed={state.muted}
                  aria-label={`${state.muted ? "Unmute" : "Mute"} ${meta.label}`}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg border",
                    state.muted
                      ? "border-white/10 text-white/20"
                      : "border-orange-400/25 text-orange-200",
                  )}
                >
                  {state.muted ? <VolumeX className="size-3.5" /> : <Icon className="size-3.5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(state.volume * 100)}
                  onChange={(e) => onVolume(part, Number(e.target.value) / 100)}
                  disabled={isUser || state.muted}
                  className="min-w-0 flex-1 accent-orange-500 disabled:opacity-25"
                  aria-label={`${meta.label} volume`}
                />
                <button
                  type="button"
                  onClick={() => onToggleSolo(part)}
                  disabled={isUser}
                  aria-pressed={soloed === part}
                  aria-label={`${soloed === part ? "Unsolo" : "Solo"} ${meta.label}`}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg border",
                    soloed === part
                      ? "border-orange-300/50 bg-orange-500/15 text-orange-200"
                      : "border-white/10 text-white/25",
                  )}
                >
                  <Headphones className="size-3.5" />
                </button>
              </div>
              <p className="mt-1.5 truncate text-center text-[10px] tracking-[0.12em] text-white/40 uppercase">
                {meta.label}
              </p>
            </article>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4",
        className,
      )}
      role="group"
      aria-label="Band mixer"
    >
      <div
        className="grid gap-2 sm:gap-3"
        style={{
          gridTemplateColumns: `repeat(${parts.length}, minmax(0, 1fr))`,
        }}
      >
        {parts.map((part) => {
          const meta = PART_META[part]
          const Icon = meta.icon
          const Figure = BAND_FIGURES[part]
          const state = mix[part] ?? { volume: 1, muted: false }
          const isUser = userPart === part
          // Soloing another part silences this one just as surely as muting
          // it, so the figure must show that too — otherwise a soloed mix
          // looks like every part is still playing.
          const silenced = state.muted || (soloed !== null && soloed !== part)

          return (
            <div key={part} className="flex min-w-0 flex-col gap-2">
              {/* Musician — tap to take the part over. */}
              <button
                type="button"
                onClick={() => onPickUserPart(isUser ? null : part)}
                aria-pressed={isUser}
                aria-label={
                  isUser
                    ? `${meta.label} — you play this. Activate to hand it back to the band.`
                    : `Play ${meta.label} yourself`
                }
                className={cn(
                  "group relative flex aspect-[3/4] w-full items-end justify-center rounded-xl border p-1 transition-colors",
                  isUser
                    ? "border-dashed border-amber-300/60 bg-amber-400/5"
                    : "border-white/10 bg-black/25 hover:border-white/25",
                )}
              >
                <Figure
                  className={cn(
                    "h-full w-full transition-colors",
                    isUser
                      ? "text-amber-300/25"
                      : silenced
                        ? "text-white/15"
                        : "text-amber-300/90 group-hover:text-amber-200",
                  )}
                />
                {isUser && (
                  <span className="absolute inset-x-0 bottom-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-amber-200/90">
                    You
                  </span>
                )}
                {silenced && !isUser && (
                  <VolumeX
                    className="absolute right-1.5 top-1.5 size-3.5 text-white/35"
                    aria-hidden="true"
                  />
                )}
              </button>

              {/* Fader. Narrow and tall — a full-width block reads as a
                  progress bar, not something you grab and pull. */}
              <div className="flex justify-center">
                <ChannelFader
                  value={state.volume}
                  onChange={(v) => onVolume(part, v)}
                  label={`${meta.label} volume`}
                  disabled={isUser || state.muted}
                  className="h-32 w-9 sm:h-40 sm:w-11"
                />
              </div>

              {/* Instrument chip: mute, with solo alongside. */}
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggleMute(part)}
                  disabled={isUser}
                  aria-pressed={state.muted}
                  aria-label={`${state.muted ? "Unmute" : "Mute"} ${meta.label}`}
                  title={meta.label}
                  className={cn(
                    "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    isUser
                      ? "cursor-not-allowed border-white/10 text-white/25"
                      : state.muted
                        ? "border-white/10 bg-black/40 text-white/40 hover:text-white/70"
                        : "border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate max-sm:hidden">{meta.label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSolo(part)}
                  disabled={isUser}
                  aria-pressed={soloed === part}
                  aria-label={`${soloed === part ? "Unsolo" : "Solo"} ${meta.label}`}
                  className={cn(
                    "rounded-lg border p-2 transition-colors",
                    isUser
                      ? "cursor-not-allowed border-white/10 text-white/25"
                      : soloed === part
                        ? "border-teal-300/50 bg-teal-400/15 text-teal-200"
                        : "border-white/10 text-white/40 hover:text-white/80",
                  )}
                >
                  <Headphones className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
