"use client"

import { useState } from "react"
import { Repeat } from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  ArrangementSection,
  ChartBar,
  ChartChord,
  LoopRange,
  SectionRole,
} from "@/lib/band-jam/engine/types"

/**
 * Chord chart for the Jam Player practice screen.
 *
 * Read at arm's length from a music stand: chord symbols are large, bars are
 * grouped 4-up under a coloured section band, and a bar's chords are laid
 * out proportional to how many beats each occupies (see `ChartChord.beats`).
 */

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing / reuse)
// ---------------------------------------------------------------------------

/**
 * Collapses a chord symbol's extensions down to its bare triad quality, e.g.
 * "CM7(9)" -> "C", "FM7(9)/A" -> "F/A", "Am7(9)" -> "Am". Used when
 * `simplifiedSymbols` is set, for readability at distance.
 */
export function simplifyChordSymbol(symbol: string): string {
  const [chordPart, bassPart] = symbol.split("/")
  if (!chordPart) return symbol

  const rootMatch = chordPart.match(/^[A-Ga-g](#|b|♯|♭)?/)
  const root = rootMatch ? rootMatch[0] : chordPart
  const rest = chordPart.slice(root.length)

  let quality = ""
  if (/^dim/i.test(rest) || /^o/.test(rest) || /^°/.test(rest)) {
    quality = "dim"
  } else if (/^aug/i.test(rest) || /^\+/.test(rest)) {
    quality = "aug"
  } else if (/^sus2/i.test(rest)) {
    quality = "sus2"
  } else if (/^sus4/i.test(rest)) {
    quality = "sus4"
  } else if (/^sus/i.test(rest)) {
    quality = "sus"
  } else if (/^m(?!aj)/.test(rest)) {
    // Lowercase "m" not followed by "aj" is minor. Uppercase "M" (as in
    // "CM7") is the major-seventh marker and collapses away below.
    quality = "m"
  }

  if (!bassPart) return `${root}${quality}`
  const bassMatch = bassPart.match(/^[A-Ga-g](#|b|♯|♭)?/)
  const bass = bassMatch ? bassMatch[0] : bassPart
  return `${root}${quality}/${bass}`
}

/** True when `barNumber` falls inside the active loop range, if any. */
export function isBarInLoop(barNumber: number, loop: LoopRange | null): boolean {
  if (!loop) return false
  return barNumber >= loop.startBar && barNumber <= loop.endBar
}

/** True when the current loop exactly spans `section` (bar-for-bar). */
export function isSectionLoopActive(
  section: ArrangementSection,
  loop: LoopRange | null,
): boolean {
  if (!loop) return false
  return loop.startBar === section.startBar && loop.endBar === section.endBar
}

/** Index of the chord that should render as the bar's "primary" symbol. */
export function primaryChordIndex(chords: ChartChord[]): number {
  let best = 0
  for (let i = 1; i < chords.length; i++) {
    if (chords[i].beats > chords[best].beats) best = i
  }
  return best
}

function displaySymbol(chord: ChartChord, simplified: boolean | undefined): string {
  return simplified ? simplifyChordSymbol(chord.symbol) : chord.symbol
}

// ---------------------------------------------------------------------------
// Section role colour language
// ---------------------------------------------------------------------------

const SECTION_ROLE_STYLES: Record<
  SectionRole,
  { band: string; bandActive: string; dot: string }
> = {
  intro: {
    band: "border-sky-400/25 bg-sky-500/10 text-sky-200",
    bandActive: "border-sky-400/60 bg-sky-500/20 text-sky-100",
    dot: "bg-sky-400",
  },
  verse: {
    band: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    bandActive: "border-emerald-400/60 bg-emerald-500/20 text-emerald-100",
    dot: "bg-emerald-400",
  },
  pre_chorus: {
    band: "border-teal-400/25 bg-teal-500/10 text-teal-200",
    bandActive: "border-teal-400/60 bg-teal-500/20 text-teal-100",
    dot: "bg-teal-400",
  },
  chorus: {
    band: "border-amber-400/25 bg-amber-500/10 text-amber-200",
    bandActive: "border-amber-400/60 bg-amber-500/20 text-amber-100",
    dot: "bg-amber-400",
  },
  bridge: {
    band: "border-violet-400/25 bg-violet-500/10 text-violet-200",
    bandActive: "border-violet-400/60 bg-violet-500/20 text-violet-100",
    dot: "bg-violet-400",
  },
  outro: {
    band: "border-rose-400/25 bg-rose-500/10 text-rose-200",
    bandActive: "border-rose-400/60 bg-rose-500/20 text-rose-100",
    dot: "bg-rose-400",
  },
  section: {
    band: "border-slate-400/25 bg-slate-500/10 text-slate-200",
    bandActive: "border-slate-400/60 bg-slate-500/20 text-slate-100",
    dot: "bg-slate-400",
  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type ChordChartProps = {
  sections: ArrangementSection[]
  /** 1-indexed playhead position; null when not playing. */
  currentBar: number | null
  /** Position within the current bar, 0-1. Drives the sweeping playhead. */
  barPhase?: number
  loop: LoopRange | null
  onLoopSection: (section: ArrangementSection) => void
  onLoopBars: (range: LoopRange | null) => void
  /** Collapse extensions to triad quality, e.g. "C/G" instead of "CM7(9)/G". */
  simplifiedSymbols?: boolean
  className?: string
}

export function ChordChart({
  sections,
  currentBar,
  barPhase = 0,
  loop,
  onLoopSection,
  onLoopBars,
  simplifiedSymbols,
  className,
}: ChordChartProps) {
  // Anchor bar for shift-click range selection. Not derived from `loop` so
  // that repeated shift-clicks keep extending from the bar the user first
  // clicked, even after the loop prop round-trips through the parent.
  const [anchorBar, setAnchorBar] = useState<number | null>(null)

  const handleSectionClick = (section: ArrangementSection) => {
    if (isSectionLoopActive(section, loop)) {
      onLoopBars(null)
      return
    }
    onLoopSection(section)
  }

  const handleBarClick = (bar: ChartBar, shiftKey: boolean) => {
    if (shiftKey && anchorBar != null) {
      onLoopBars({
        startBar: Math.min(anchorBar, bar.barNumber),
        endBar: Math.max(anchorBar, bar.barNumber),
      })
      return
    }
    setAnchorBar(bar.barNumber)
    onLoopBars({ startBar: bar.barNumber, endBar: bar.barNumber })
  }

  return (
    <div className={cn("space-y-6", className)}>
      {sections.map((section) => (
        <SectionBlock
          key={`${section.role}-${section.startBar}`}
          section={section}
          currentBar={currentBar}
          barPhase={barPhase}
          loop={loop}
          simplifiedSymbols={simplifiedSymbols}
          onSectionClick={handleSectionClick}
          onBarClick={handleBarClick}
        />
      ))}
    </div>
  )
}

function SectionBlock({
  section,
  currentBar,
  barPhase = 0,
  loop,
  simplifiedSymbols,
  onSectionClick,
  onBarClick,
}: {
  section: ArrangementSection
  currentBar: number | null
  /** Position within the current bar, 0-1. Drives the sweeping playhead. */
  barPhase?: number
  loop: LoopRange | null
  simplifiedSymbols?: boolean
  onSectionClick: (section: ArrangementSection) => void
  onBarClick: (bar: ChartBar, shiftKey: boolean) => void
}) {
  const roleStyle = SECTION_ROLE_STYLES[section.role] ?? SECTION_ROLE_STYLES.section
  const active = isSectionLoopActive(section, loop)

  return (
    <section className="space-y-2.5">
      <button
        type="button"
        onClick={() => onSectionClick(section)}
        aria-pressed={active}
        aria-label={
          active
            ? `${section.label}: looping, click to clear loop`
            : `Play section ${section.label}`
        }
        className={cn(
          "flex min-h-10 w-full items-center gap-2 border-b px-1 py-2 text-left text-[11px] font-bold tracking-[0.16em] uppercase transition",
          active ? roleStyle.bandActive : roleStyle.band,
        )}
      >
        <span className={cn("size-2 shrink-0 rounded-full", roleStyle.dot)} />
        <span className="truncate">{section.label}</span>
        <Repeat
          className={cn(
            "ml-auto size-3.5 shrink-0",
            active ? "opacity-100" : "opacity-50",
          )}
          aria-hidden="true"
        />
      </button>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        {section.bars.map((bar) => (
          <BarCell
            key={bar.barNumber}
            bar={bar}
            isCurrent={currentBar === bar.barNumber}
            barPhase={barPhase}
            inLoop={isBarInLoop(bar.barNumber, loop)}
            simplifiedSymbols={simplifiedSymbols}
            onClick={(shiftKey) => onBarClick(bar, shiftKey)}
          />
        ))}
      </div>
    </section>
  )
}

function BarCell({
  bar,
  isCurrent,
  barPhase = 0,
  inLoop,
  simplifiedSymbols,
  onClick,
}: {
  bar: ChartBar
  isCurrent: boolean
  barPhase?: number
  inLoop: boolean
  simplifiedSymbols?: boolean
  onClick: (shiftKey: boolean) => void
}) {
  const primary = primaryChordIndex(bar.chords)
  const chordSymbols = bar.chords.map((c) => displaySymbol(c, simplifiedSymbols))

  return (
    <button
      type="button"
      onClick={(e) => onClick(e.shiftKey)}
      aria-current={isCurrent ? "true" : undefined}
      aria-label={`Bar ${bar.barNumber}: ${bar.chords.map((c) => c.symbol).join(", ")}`}
      className={cn(
        "relative flex min-h-20 w-full items-stretch overflow-hidden rounded-xl border bg-[#101010] transition sm:min-h-24",
        inLoop ? "border-orange-400/35 bg-orange-500/[0.045]" : "border-white/8",
        isCurrent &&
          "border-orange-400 bg-orange-500/10 ring-2 ring-orange-400/35 ring-offset-2 ring-offset-[#080808]",
      )}
    >
      {/* Intra-bar playhead. Highlighting only the bar tells you WHERE you are
          but not WHEN within it — at music-stand distance that difference is
          what keeps you in time. Transition is off so it tracks the beat
          rather than easing behind it. */}
      {isCurrent ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-orange-300/90 shadow-[0_0_10px_rgba(253,186,116,0.8)]"
          style={{ left: `${Math.min(100, Math.max(0, barPhase * 100))}%` }}
        />
      ) : null}

      <span className="pointer-events-none absolute top-1.5 left-2 font-mono text-[9px] leading-none text-white/25">
        {bar.barNumber}
      </span>

      <span className="flex w-full items-stretch divide-x divide-white/10">
        {bar.chords.map((chord, i) => (
          <span
            key={i}
            style={{ flexGrow: chord.beats, flexBasis: 0 }}
            className="flex min-w-0 shrink-0 items-center justify-center px-1 py-2"
          >
            <span
              className={cn(
                "truncate font-[family-name:var(--font-instrument-serif)] leading-none whitespace-nowrap text-white",
                i === primary
                  ? "text-2xl sm:text-3xl"
                  : "text-base text-white/55 sm:text-lg",
              )}
            >
              {chordSymbols[i]}
            </span>
          </span>
        ))}
      </span>
    </button>
  )
}
