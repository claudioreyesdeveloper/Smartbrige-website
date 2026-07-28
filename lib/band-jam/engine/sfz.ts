/**
 * SFZ parser for the SmartBridge Jam Player browser sampler.
 *
 * Supports exactly the 13 opcodes present in the converted MegaVoice / GM-drum
 * SFZ files (see docs/jam-player-voice-engine.md §3.1):
 *
 *   sample, offset, end, loop_mode, lokey, hikey, key, pitch_keycenter,
 *   lovel, hivel, volume, amp_veltrack, ampeg_release, ampeg_sustain, transpose
 *
 * Everything else (`global_label`, `group_label`, and any other opcode that
 * shows up in future conversions) is tokenized but silently discarded —
 * this parser never throws on unknown opcodes.
 *
 * Domain rule (docs/jam-player-voice-engine.md §3.3): on these MegaVoice
 * instruments velocity selects ARTICULATION, not loudness. `selectRegion`
 * matches velocity bands exactly — no interpolation, no crossfading between
 * layers.
 */

import type { SfzInstrument, SfzRegion } from "./types"

// ---------------------------------------------------------------------------
// Tokenizing
// ---------------------------------------------------------------------------

/**
 * Matches a header tag or an `opcode=` marker. Everything between the end of
 * one match and the start of the next is that opcode's value.
 *
 * This is what makes `sample=` (whose value contains spaces, e.g.
 * `sample=077_SolidGuitar1 MegaVoice Samples/...-36-20.wav`) safe to parse
 * without a naive space-split: the value simply runs up to whatever the next
 * `identifier=` token is, wherever it falls (same line or next line), space
 * or newline included, then gets trimmed.
 */
const TOKEN_RE = /<global>|<group>|<region>|[a-zA-Z_][a-zA-Z0-9_]*=/g

type Opcodes = Record<string, string>

/** Strip `//` line comments. None of the known opcode values contain `//`. */
function stripComments(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//")
      return i === -1 ? line : line.slice(0, i)
    })
    .join("\n")
}

/**
 * Walk the token stream and resolve the `<global>` / `<group>` / `<region>`
 * hierarchy into one flat opcode map per region, with region opcodes
 * overriding group opcodes overriding global opcodes (last-wins-on-conflict,
 * most-specific-wins-on-scope).
 */
function extractRawRegions(text: string): Opcodes[] {
  const clean = stripComments(text)
  const regions: Opcodes[] = []

  let globalOpcodes: Opcodes = {}
  let groupOpcodes: Opcodes = {}
  let regionOpcodes: Opcodes | null = null
  let current: Opcodes = {} // opcodes before the first header tag are discarded

  const finishRegion = () => {
    if (regionOpcodes) {
      regions.push({ ...globalOpcodes, ...groupOpcodes, ...regionOpcodes })
    }
    regionOpcodes = null
  }

  let pendingOpcodeName: string | null = null
  let pendingValueStart = 0

  const flushPendingOpcode = (valueEnd: number) => {
    if (pendingOpcodeName !== null) {
      current[pendingOpcodeName] = clean.slice(pendingValueStart, valueEnd).trim()
      pendingOpcodeName = null
    }
  }

  TOKEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN_RE.exec(clean)) !== null) {
    flushPendingOpcode(match.index)

    const tok = match[0]
    if (tok === "<global>") {
      finishRegion()
      globalOpcodes = {}
      current = globalOpcodes
    } else if (tok === "<group>") {
      finishRegion()
      groupOpcodes = {}
      current = groupOpcodes
    } else if (tok === "<region>") {
      finishRegion()
      regionOpcodes = {}
      current = regionOpcodes
    } else {
      // an "identifier=" opcode marker
      pendingOpcodeName = tok.slice(0, -1)
      pendingValueStart = TOKEN_RE.lastIndex
    }
  }
  flushPendingOpcode(clean.length)
  finishRegion()

  return regions
}

// ---------------------------------------------------------------------------
// Region construction
// ---------------------------------------------------------------------------

function numOpt(v: string | undefined): number | undefined {
  if (v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function toRegion(raw: Opcodes): SfzRegion | null {
  const sample = raw.sample?.trim()
  if (!sample) return null

  // `key=N` is shorthand for lokey=hikey=pitch_keycenter=N; explicit
  // lokey/hikey/pitch_keycenter opcodes (when also present) take precedence.
  const keyShorthand = numOpt(raw.key)
  const loKey = numOpt(raw.lokey) ?? keyShorthand ?? 0
  const hiKey = numOpt(raw.hikey) ?? keyShorthand ?? 127
  const pitchKeycenter = numOpt(raw.pitch_keycenter) ?? keyShorthand ?? loKey

  const loVel = numOpt(raw.lovel) ?? 1
  const hiVel = numOpt(raw.hivel) ?? 127

  const offset = numOpt(raw.offset) ?? 0
  // `end` absent means "play to end of sample" — represented as -1.
  const end = numOpt(raw.end) ?? -1

  const loop = raw.loop_mode === "loop_continuous"

  const volume = numOpt(raw.volume) ?? 0
  const ampVeltrack = numOpt(raw.amp_veltrack) ?? 100
  const ampegRelease = numOpt(raw.ampeg_release) ?? 0
  const ampegSustain = numOpt(raw.ampeg_sustain) ?? 100
  const transpose = numOpt(raw.transpose) ?? 0

  return {
    sample,
    loKey,
    hiKey,
    pitchKeycenter,
    loVel,
    hiVel,
    offset,
    end,
    loop,
    volume,
    ampVeltrack,
    ampegRelease,
    ampegSustain,
    transpose,
  }
}

/** Parse an SFZ file's text into an `SfzInstrument`. Never throws. */
export function parseSfz(
  text: string,
  sampleBaseUrl: string,
  id: string,
  label: string,
): SfzInstrument {
  const regions: SfzRegion[] = []
  for (const raw of extractRawRegions(text)) {
    const region = toRegion(raw)
    if (region) regions.push(region)
  }
  return { id, label, sampleBaseUrl, regions }
}

// ---------------------------------------------------------------------------
// Region lookup
// ---------------------------------------------------------------------------

const MIDI_KEY_COUNT = 128

/** Regions bucketed by MIDI key so note-on lookup never scans the full list. */
export type SfzRegionIndex = {
  byKey: readonly (readonly SfzRegion[])[]
}

export function buildRegionIndex(instrument: SfzInstrument): SfzRegionIndex {
  const byKey: SfzRegion[][] = Array.from({ length: MIDI_KEY_COUNT }, () => [])
  for (const region of instrument.regions) {
    const lo = Math.max(0, Math.min(MIDI_KEY_COUNT - 1, Math.min(region.loKey, region.hiKey)))
    const hi = Math.max(0, Math.min(MIDI_KEY_COUNT - 1, Math.max(region.loKey, region.hiKey)))
    for (let k = lo; k <= hi; k++) {
      byKey[k].push(region)
    }
  }
  return { byKey }
}

/**
 * Find the region for a note-on. Matches key range AND velocity band
 * exactly — velocity selects articulation on these instruments, so there is
 * no nearest-velocity fallback. Among regions that match (normally exactly
 * one, since key/velocity zones don't overlap in these files), the one
 * whose `pitchKeycenter` is nearest `note` wins. Returns null rather than
 * throwing when nothing matches.
 */
export function selectRegion(index: SfzRegionIndex, note: number, velocity: number): SfzRegion | null {
  if (!Number.isFinite(note) || note < 0 || note >= MIDI_KEY_COUNT) return null

  const candidates = index.byKey[note]
  if (!candidates || candidates.length === 0) return null

  let best: SfzRegion | null = null
  let bestDist = Infinity
  for (const region of candidates) {
    if (velocity < region.loVel || velocity > region.hiVel) continue
    const dist = Math.abs(region.pitchKeycenter - note)
    if (dist < bestDist) {
      best = region
      bestDist = dist
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Gain / pitch
// ---------------------------------------------------------------------------

/**
 * Linear amplitude (nominally 0-1, can exceed 1 if `volume` boosts) for
 * `region` at note-on `velocity` (MIDI 0-127).
 *
 * Formula:
 *   1. `volume` (dB) -> linear:  base = 10 ^ (volume / 20)
 *   2. `amp_veltrack` (0-100%) blends between "velocity has no effect on
 *      gain" and "full quadratic velocity tracking" — the standard SFZ
 *      curve:
 *        veltrack       = clamp(ampVeltrack, -100, 100) / 100
 *        velNorm        = clamp(velocity, 0, 127) / 127
 *        velocityFactor = (1 - veltrack) + veltrack * velNorm^2
 *      veltrack=0   -> velocityFactor is always 1 (no velocity effect)
 *      veltrack=100 -> velocityFactor = velNorm^2 (velocity 127 = unity,
 *                       velocity 1 ~= 0)
 *   3. gain = base * velocityFactor, floored at 0.
 *
 * Note: on these MegaVoice instruments velocity mainly selects ARTICULATION
 * via `selectRegion` (region choice), not loudness — `amp_veltrack` in the
 * converted files is small (~16.67%), so this factor is a mild trim on top
 * of the already-selected region, never the primary dynamic control. See
 * docs/jam-player-voice-engine.md §3.3.
 */
export function regionGain(region: SfzRegion, velocity: number): number {
  const base = Math.pow(10, region.volume / 20)
  const veltrack = Math.max(-100, Math.min(100, region.ampVeltrack)) / 100
  const velNorm = Math.max(0, Math.min(127, velocity)) / 127
  const velocityFactor = 1 - veltrack + veltrack * velNorm * velNorm
  return Math.max(0, base * velocityFactor)
}

/**
 * Playback-rate multiplier (1.0 = unpitched) for sounding `region` at MIDI
 * `note`:
 *
 *   semitones = (note - region.pitchKeycenter) + region.transpose
 *   rate      = 2 ^ (semitones / 12)
 *
 * FX regions (see FX_PITCH_MIN in ./types) map one exact key to one
 * recording — loKey === hiKey === pitchKeycenter — so calling this with the
 * same note the region was selected for naturally yields rate 1. Callers
 * must never feed a transposed/folded note into an FX region's playback
 * rate; that transformation must not happen upstream for notes > FX_PITCH_MIN
 * in the first place (see docs/jam-player-voice-engine.md §3.3, rule 2).
 */
export function playbackRateFor(region: SfzRegion, note: number): number {
  const semitones = note - region.pitchKeycenter + region.transpose
  return Math.pow(2, semitones / 12)
}
