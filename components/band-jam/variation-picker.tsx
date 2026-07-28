"use client"

import { cn } from "@/lib/utils"

/**
 * Variation A/B/C/D — four different takes of the same style.
 *
 * Deliberately the Yamaha arranger metaphor: on the keyboard, Main A-D is an
 * intensity ladder you switch while playing, not a setup option. Same
 * progression, same key, same tempo — a different band performance.
 *
 * The catalogue guarantees variations[role][0] === slots[role], so A is always
 * the take the selection logic considers best; B/C/D are the runners-up.
 */

const LABELS = ["A", "B", "C", "D"]

export function VariationPicker({
  count,
  value,
  onChange,
  className,
  variant = "compact",
}: {
  count: number
  value: number
  onChange: (index: number) => void
  className?: string
  variant?: "compact" | "dock"
}) {
  // One take means there is nothing to choose between.
  if (count <= 1) return null

  return (
    <div
      className={cn(
        variant === "dock"
          ? "grid grid-cols-4 gap-2"
          : "flex items-center gap-1 rounded-xl border border-white/12 bg-black/35 p-1",
        className,
      )}
      role="group"
      aria-label="Variation"
    >
      {variant === "compact" ? (
        <span className="px-1.5 text-[10px] tracking-wider text-slate-500 uppercase">
          Var
        </span>
      ) : null}
      {LABELS.slice(0, count).map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(i)}
          aria-pressed={value === i}
          aria-label={`Variation ${label}`}
          className={cn(
            variant === "dock"
              ? "relative h-16 overflow-hidden rounded-xl border text-lg font-semibold transition sm:h-20"
              : "size-9 rounded-lg text-sm font-medium transition-colors",
            value === i
              ? variant === "dock"
                ? "border-orange-300 bg-orange-500 text-black shadow-[0_0_28px_rgba(249,115,22,0.2)]"
                : "bg-orange-500 text-black"
              : variant === "dock"
                ? "border-white/10 bg-white/[0.025] text-white/45 hover:border-orange-400/30 hover:text-orange-200"
                : "text-slate-300 hover:bg-white/5",
          )}
        >
          {variant === "dock" ? (
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          ) : null}
          {label}
        </button>
      ))}
    </div>
  )
}
