"use client"

import { Maximize2, Minimize2, Pause, Play, Repeat, Square, Timer, TrendingUp } from "lucide-react"
import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { TransportStatus } from "@/lib/band-jam/engine/types"

/**
 * Performance controls, not setup controls.
 *
 * Tempo and key are steppers rather than dropdowns on purpose: they are the
 * reason the engine plays note events instead of baked audio, and they are
 * adjusted mid-playback with an instrument in hand. Sized for a thumb, since
 * this sits at the bottom of a phone on a music stand.
 */

const KEY_LABELS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
]

export function keyLabel(pc: number): string {
  return KEY_LABELS[((pc % 12) + 12) % 12]
}

export type TransportBarProps = {
  status: TransportStatus
  tempo: number
  tempoMin: number
  tempoMax: number
  targetTempo: number | null
  keyPc: number
  countIn: boolean
  metronome: boolean
  loopActive: boolean
  onPlayPause: () => void
  onStop: () => void
  onTempo: (bpm: number) => void
  onTranspose: (semitones: number) => void
  onToggleCountIn: () => void
  onToggleMetronome: () => void
  onClearLoop: () => void
  rampOn: boolean
  onToggleRamp: () => void
  onTargetTempo: (bpm: number) => void
  standMode?: boolean
  onToggleStandMode?: () => void
  /** Beat position 0-1 within the bar, for the visual pulse. */
  barPhase?: number
  className?: string
  variant?: "bar" | "rail"
}

export function TransportBar({
  status,
  tempo,
  tempoMin,
  tempoMax,
  targetTempo,
  keyPc,
  countIn,
  metronome,
  loopActive,
  onPlayPause,
  onStop,
  onTempo,
  onTranspose,
  onToggleCountIn,
  onToggleMetronome,
  onClearLoop,
  rampOn,
  onToggleRamp,
  onTargetTempo,
  standMode,
  onToggleStandMode,
  barPhase = 0,
  className,
  variant = "bar",
}: TransportBarProps) {
  const playing = status === "playing"
  const busy = status === "loading"
  const beatInBar = Math.floor(barPhase * 4)

  // Tap tempo: four taps is faster and more musical than forty stepper clicks.
  const tapsRef = useRef<number[]>([])
  const [tapHint, setTapHint] = useState<number | null>(null)
  const tap = () => {
    const now = performance.now()
    const taps = tapsRef.current.filter((x) => now - x < 3000)
    taps.push(now)
    tapsRef.current = taps.slice(-5)
    if (tapsRef.current.length >= 2) {
      const gaps = tapsRef.current
        .slice(1)
        .map((x, i) => x - tapsRef.current[i])
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
      const bpm = Math.round(60000 / mean)
      if (bpm >= tempoMin && bpm <= tempoMax) {
        setTapHint(bpm)
        onTempo(bpm)
      }
    }
  }

  const stepTempo = (delta: number) =>
    onTempo(Math.max(tempoMin, Math.min(tempoMax, tempo + delta)))

  if (variant === "rail") {
    return (
      <div
        className={cn("space-y-5", className)}
        role="group"
        aria-label="Transport"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPlayPause}
            disabled={busy}
            className="flex size-14 items-center justify-center rounded-full bg-orange-500 text-black shadow-[0_0_30px_rgba(249,115,22,0.2)] transition hover:bg-orange-400 disabled:opacity-50"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5 fill-current" />}
          </button>
          <button
            type="button"
            onClick={onStop}
            className="flex size-11 items-center justify-center rounded-xl border border-white/10 text-white/55 transition hover:border-white/25 hover:text-white"
            aria-label="Stop"
          >
            <Square className="size-4" />
          </button>
          {playing ? (
            <div className="ml-auto flex items-center gap-1" aria-label="Beat">
              {[0, 1, 2, 3].map((beat) => (
                <span
                  key={beat}
                  className={cn(
                    "size-2 rounded-full",
                    beatInBar === beat
                      ? beat === 0
                        ? "bg-orange-400"
                        : "bg-amber-200"
                      : "bg-white/12",
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>

        <RailStepper
          label="Tempo"
          value={`${Math.round(tempo)} bpm`}
          onMinus={() => stepTempo(-1)}
          onPlus={() => stepTempo(1)}
          minusLabel="Slower"
          plusLabel="Faster"
        />
        <button
          type="button"
          onClick={tap}
          className="h-10 w-full rounded-lg border border-orange-400/30 text-xs font-medium tracking-[0.16em] text-orange-300 uppercase transition hover:bg-orange-500/10"
        >
          Tap tempo{tapHint ? ` · ${tapHint}` : ""}
        </button>

        <RailStepper
          label="Key"
          value={keyLabel(keyPc)}
          onMinus={() => onTranspose(-1)}
          onPlus={() => onTranspose(1)}
          minusLabel="Down a semitone"
          plusLabel="Up a semitone"
        />

        <div className="grid grid-cols-2 gap-2">
          <RailToggle active={countIn} onClick={onToggleCountIn} label="Count-in">
            <span className="font-semibold">4</span>
            <span>Count</span>
          </RailToggle>
          <RailToggle active={metronome} onClick={onToggleMetronome} label="Metronome">
            <Timer className="size-4" />
            <span>Click</span>
          </RailToggle>
          <RailToggle active={rampOn} onClick={onToggleRamp} label="Tempo trainer">
            <TrendingUp className="size-4" />
            <span>Trainer</span>
          </RailToggle>
          {onToggleStandMode ? (
            <RailToggle active={!!standMode} onClick={onToggleStandMode} label="Stand mode">
              {standMode ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              <span>Focus</span>
            </RailToggle>
          ) : null}
        </div>

        {loopActive ? (
          <button
            type="button"
            onClick={onClearLoop}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-orange-400/35 bg-orange-500/10 text-xs text-orange-200"
          >
            <Repeat className="size-4" />
            Clear loop
          </button>
        ) : null}

        {rampOn ? (
          <RailStepper
            label="Trainer goal"
            value={`${targetTempo ?? tempo} bpm`}
            onMinus={() => onTargetTempo(Math.max(tempo + 1, (targetTempo ?? tempo) - 2))}
            onPlus={() => onTargetTempo(Math.min(tempoMax, (targetTempo ?? tempo) + 2))}
            minusLabel="Lower target tempo"
            plusLabel="Raise target tempo"
          />
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#111]/95 p-2.5 shadow-2xl backdrop-blur sm:gap-3",
        className,
      )}
      role="group"
      aria-label="Transport"
    >
      <button
        type="button"
        onClick={onPlayPause}
        disabled={busy}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-orange-500 text-black transition-colors hover:bg-orange-400 disabled:opacity-50"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause className="size-5" aria-hidden="true" />
        ) : (
          <Play className="size-5" aria-hidden="true" />
        )}
      </button>

      <button
        type="button"
        onClick={onStop}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/12 text-slate-300 transition-colors hover:bg-white/5"
        aria-label="Stop"
      >
        <Square className="size-4" aria-hidden="true" />
      </button>

      <ToggleButton
        active={countIn}
        onClick={onToggleCountIn}
        label="Count-in"
      >
        <span className="text-sm font-medium">4</span>
      </ToggleButton>

      <ToggleButton
        active={metronome}
        onClick={onToggleMetronome}
        label="Metronome"
      >
        <Timer className="size-4" aria-hidden="true" />
      </ToggleButton>

      {/* Visual beat, for practising with headphones off or in a loud room.
          Downbeat reads differently from 2-3-4. */}
      {playing ? (
        <div
          className="flex items-center gap-1 px-1"
          aria-hidden="true"
          title="Beat"
        >
          {[0, 1, 2, 3].map((b) => (
            <span
              key={b}
              className={cn(
                "size-2 rounded-full transition-colors",
                beatInBar === b
                  ? b === 0
                    ? "bg-rose-400"
                    : "bg-amber-300"
                  : "bg-white/15",
              )}
            />
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={tap}
        className="flex h-11 shrink-0 items-center rounded-xl border border-white/12 px-3 text-xs text-slate-300 transition-colors hover:bg-white/5"
        aria-label="Tap tempo"
      >
        TAP{tapHint ? ` ${tapHint}` : ""}
      </button>

      {loopActive ? (
        <ToggleButton active onClick={onClearLoop} label="Clear loop">
          <Repeat className="size-4" aria-hidden="true" />
        </ToggleButton>
      ) : null}

      <ToggleButton
        active={rampOn}
        onClick={onToggleRamp}
        label="Tempo trainer — step the tempo up as you play"
      >
        <TrendingUp className="size-4" aria-hidden="true" />
      </ToggleButton>

      {rampOn ? (
        <div className="flex items-center gap-1 rounded-xl border border-sky-400/40 bg-sky-500/10 px-1.5 py-1">
          <button
            type="button"
            onClick={() => onTargetTempo(Math.max(tempo + 1, (targetTempo ?? tempo) - 2))}
            className="size-8 rounded-lg text-slate-300 hover:bg-white/5"
            aria-label="Lower target tempo"
          >
            &minus;
          </button>
          <span className="min-w-[54px] text-center text-xs text-sky-200 tabular-nums">
            goal {targetTempo ?? tempo}
          </span>
          <button
            type="button"
            onClick={() => onTargetTempo(Math.min(tempoMax, (targetTempo ?? tempo) + 2))}
            className="size-8 rounded-lg text-slate-300 hover:bg-white/5"
            aria-label="Raise target tempo"
          >
            +
          </button>
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-1.5 border-l border-white/10 pl-2 sm:pl-3">
        <StepButton onClick={() => stepTempo(-1)} label="Slower">
          &minus;
        </StepButton>
        <div className="min-w-[68px] text-center">
          <div className="text-lg leading-tight font-medium text-slate-50 tabular-nums">
            {Math.round(tempo)}
          </div>
          <div className="text-[10px] text-slate-500">
            bpm{targetTempo ? ` · goal ${Math.round(targetTempo)}` : ""}
          </div>
        </div>
        <StepButton onClick={() => stepTempo(1)} label="Faster">
          +
        </StepButton>
      </div>

      {onToggleStandMode ? (
        <ToggleButton
          active={!!standMode}
          onClick={onToggleStandMode}
          label="Stand mode — hide everything but the chart and transport"
        >
          {standMode ? (
            <Minimize2 className="size-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="size-4" aria-hidden="true" />
          )}
        </ToggleButton>
      ) : null}

      <div className="flex items-center gap-1.5 border-l border-white/10 pl-2 sm:pl-3">
        <StepButton onClick={() => onTranspose(-1)} label="Down a semitone">
          &#9837;
        </StepButton>
        <div className="min-w-[38px] text-center">
          <div className="text-lg leading-tight font-medium text-slate-50">
            {keyLabel(keyPc)}
          </div>
          <div className="text-[10px] text-slate-500">key</div>
        </div>
        <StepButton onClick={() => onTranspose(1)} label="Up a semitone">
          &#9839;
        </StepButton>
      </div>
    </div>
  )
}

function RailStepper({
  label,
  value,
  onMinus,
  onPlus,
  minusLabel,
  plusLabel,
}: {
  label: string
  value: string
  onMinus: () => void
  onPlus: () => void
  minusLabel: string
  plusLabel: string
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="tracking-wide text-white/45 uppercase">{label}</span>
        <span className="font-medium text-white tabular-nums">{value}</span>
      </div>
      <div className="grid grid-cols-[40px_1fr_40px] overflow-hidden rounded-lg border border-white/10">
        <button type="button" onClick={onMinus} aria-label={minusLabel} className="h-10 text-white/55 hover:bg-white/5">−</button>
        <span className="flex items-center justify-center border-x border-white/10 text-xs text-white/25">••••••</span>
        <button type="button" onClick={onPlus} aria-label={plusLabel} className="h-10 text-orange-300 hover:bg-orange-500/10">+</button>
      </div>
    </div>
  )
}

function RailToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-lg border text-xs transition",
        active
          ? "border-orange-400/40 bg-orange-500/12 text-orange-200"
          : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/70",
      )}
    >
      {children}
    </button>
  )
}

function StepButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-xl border border-white/12 text-base text-slate-200 transition-colors hover:bg-white/5"
      aria-label={label}
    >
      {children}
    </button>
  )
}

function ToggleButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors",
        active
          ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
          : "border-white/12 text-slate-400 hover:bg-white/5",
      )}
    >
      {children}
    </button>
  )
}
