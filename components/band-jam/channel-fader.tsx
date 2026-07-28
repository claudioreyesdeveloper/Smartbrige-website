"use client"

import { useCallback, useRef } from "react"
import { cn } from "@/lib/utils"

/**
 * Vertical channel fader.
 *
 * Custom rather than a styled `<input type="range">` because the vertical
 * orientation still needs `-webkit-appearance: slider-vertical` in some
 * engines and `writing-mode: vertical-lr` in others, and neither gives you a
 * track you can actually paint. So: a plain element with pointer handling and
 * the full slider ARIA contract, which ends up more accessible than the input
 * it replaces — the old horizontal slider had no value text, so a screen
 * reader announced "42" with no unit and no part name.
 *
 * Drag anywhere on the track to jump and scrub. Keyboard is arrows for 5%,
 * shift-arrows for 1%, PageUp/PageDown for 20%, Home/End for the ends.
 */

export type ChannelFaderProps = {
  /** 0-1. */
  value: number
  onChange: (value: number) => void
  /** Announced to assistive tech, e.g. "Guitar volume". */
  label: string
  disabled?: boolean
  className?: string
}

const STEP = 0.05
const FINE_STEP = 0.01
const PAGE_STEP = 0.2

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export function ChannelFader({
  value,
  onChange,
  label,
  disabled = false,
  className,
}: ChannelFaderProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  /** Screen Y -> value, with the top of the track being 1. */
  const valueFromPointer = useCallback((clientY: number) => {
    const el = trackRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.height <= 0) return null
    return clamp01(1 - (clientY - rect.top) / rect.height)
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return
      // Capture so a drag that leaves the element keeps scrubbing, which is
      // what makes a fader feel like a fader rather than a button.
      e.currentTarget.setPointerCapture(e.pointerId)
      const next = valueFromPointer(e.clientY)
      if (next !== null) onChange(next)
    },
    [disabled, onChange, valueFromPointer],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return
      const next = valueFromPointer(e.clientY)
      if (next !== null) onChange(next)
    },
    [disabled, onChange, valueFromPointer],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return
      const step = e.shiftKey ? FINE_STEP : STEP
      let next: number | null = null
      switch (e.key) {
        case "ArrowUp":
        case "ArrowRight":
          next = value + step
          break
        case "ArrowDown":
        case "ArrowLeft":
          next = value - step
          break
        case "PageUp":
          next = value + PAGE_STEP
          break
        case "PageDown":
          next = value - PAGE_STEP
          break
        case "Home":
          next = 0
          break
        case "End":
          next = 1
          break
        default:
          return
      }
      e.preventDefault()
      onChange(clamp01(next))
    },
    [disabled, onChange, value],
  )

  const pct = Math.round(clamp01(value) * 100)

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
      aria-disabled={disabled || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative cursor-ns-resize touch-none select-none rounded-md",
        "bg-white/8 outline-none ring-offset-2 ring-offset-black/40",
        "focus-visible:ring-2 focus-visible:ring-amber-400/70",
        disabled && "cursor-not-allowed opacity-35",
        className,
      )}
    >
      {/* Fill from the bottom up. */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 rounded-md transition-[height] duration-75",
          disabled
            ? "bg-white/20"
            : "bg-gradient-to-t from-amber-500 to-amber-300",
        )}
        style={{ height: `${pct}%` }}
      />
      {/* Cap: the grip line that marks the current level. */}
      <div
        className="pointer-events-none absolute inset-x-0 h-2.5 -translate-y-1/2 px-0.5"
        style={{ bottom: `${pct}%` }}
      >
        <div
          className={cn(
            "h-full w-full rounded-sm border shadow-sm",
            disabled
              ? "border-white/15 bg-white/25"
              : "border-black/40 bg-teal-300",
          )}
        />
      </div>
    </div>
  )
}
