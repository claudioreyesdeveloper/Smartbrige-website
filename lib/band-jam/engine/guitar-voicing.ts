/**
 * Genre-aware guitar re-voicer — TypeScript port of the desktop engine's
 * GuitarVoicingTransform.
 *
 * SOURCE OF TRUTH (read fully before touching this file):
 *   SmartBridge/Source/Core/GuitarVoicingTransform.h    — style catalogue & intent
 *   SmartBridge/Source/Core/GuitarVoicingTransform.cpp  — the algorithm
 *   SmartBridge/Source/Core/HarmonicContract.h           — parseChordSymbol (quality parsing)
 *
 * This is a faithful port, not a reinvention: constants, thresholds, register
 * pockets and per-style logic below are taken from the .cpp 1:1 wherever the
 * interface change (JUCE MidiMessageSequence + chordTimingsJson -> plain
 * NoteEvent[]/ChordEvent[]) allows it. Every place where the port had to make
 * a judgment call because of that interface difference is called out in a
 * comment at the point of the decision — see especially applyFunk() below.
 *
 * What this module deliberately does NOT touch (ported rule, see header
 * comment in GuitarVoicingTransform.h):
 *   - MegaVoice trigger-lane notes (note > FX_PITCH_MIN, i.e. >= 84): these
 *     are articulation keys, not pitched chord tones. They pass through
 *     completely unchanged.
 *   - The timing (onset beat) of any stroke. Per-note micro-staggers that the
 *     source itself introduces as part of a style's voicing (e.g. Power's
 *     root-to-fifth lag, Jazz's simultaneous drop-2 stack) are part of the
 *     ported algorithm, not "timing changes" to an existing note — no
 *     pre-existing note ever has its beat field altered.
 *   - Velocities/durations of newly added notes are copied from the
 *     strongest note in the stroke (peak velocity + the stroke's longest
 *     end-beat) so groove and dynamics survive, UNLESS a style defines its
 *     own explicit velocity/duration model (Power, Jazz, Funk all do, per
 *     the source).
 *
 * Skipped (per porting brief — not straightforward / out of scope):
 *   - applyColourVariations: a separate, randomised, content-authoring-time
 *     pass (stable-seed hashed 7th/13th "colour" additions for imported
 *     libraries). Not part of the runtime re-voicing decision.
 *   - revoiceFunkOutOfRangeNotes: a content-authoring-time cleanup pass that
 *     nudges already-imported funk MIDI into the funk grip register. Not
 *     part of runtime re-voicing.
 *
 * Chord-quality vocabulary parsed from ChordEvent.name (see parseChordQuality
 * below): major / minor / dominant-7 / maj7 / min7 / dim / dim7 / half-dim
 * (m7b5) / aug / sus2 / sus4, exactly mirroring HarmonicContract::
 * parseChordSymbol's token rules (case-sensitive "M7"/"maj7" detection,
 * "m"/"-"/"min" minor detection, "ø"/"m7b5" half-diminished, "°"/"dim"
 * diminished, "sus2"/"sus4"/"sus" suspended). ChordEvent.root is used
 * directly as the root pitch class (already transposed into the target key
 * by the caller) — only the quality *suffix* of `name` is parsed.
 */

import type { ChordEvent, NoteEvent } from "./types"
import { FX_PITCH_MIN } from "./types"

// ---------------------------------------------------------------------------
// Style catalogue (GuitarVoicingTransform::Style / styleName)
// ---------------------------------------------------------------------------

export type VoicingStyle =
  | "None" // explicit no-op
  | "PopOpen" // default "do not transform" (alias of None when nothing to add)
  | "Power" // R + 5
  | "Funk" // shell: 3 + colour (+9)
  | "Jazz" // drop-2: 5(low) - R - 3 - 7
  | "Reggae" // top 3 strings
  | "Latin" // bass + upper triad
  | "Blues" // ensure dom7 on every stroke
  | "Muted" // force upper guitar notes into the mute sample band

/** Convenience identifier for log lines / saved state. Port of styleName(). */
export function styleName(s: VoicingStyle): string {
  switch (s) {
    case "None":
      return "Off"
    case "PopOpen":
      return "Pop"
    case "Power":
      return "Power"
    case "Funk":
      return "Funk"
    case "Jazz":
      return "Jazz"
    case "Reggae":
      return "Reggae"
    case "Latin":
      return "Latin"
    case "Blues":
      return "Blues"
    case "Muted":
      return "Muted"
  }
}

/**
 * Map the "Auto" UI choice to a concrete Style based on the rhythm clip's
 * category (the `category` column of rhythm_guitar_clips, e.g. "Funk",
 * "Rock 8-beat", "Jazz", "Reggae", "Latin Pop", "Pop Slow", "Blues Slow",
 * "Basic_Strumming"). Returns "PopOpen" when no rule matches.
 *
 * Port of GuitarVoicingTransform::resolveAutoFromCategory.
 */
export function resolveAutoFromCategory(categoryName: string): VoicingStyle {
  const c = categoryName.trim().toLowerCase()
  if (c.length === 0) return "PopOpen"

  if (c.includes("funk") || c === "r&b") return "Funk"
  if (c.includes("jazz")) return "Jazz"
  if (c.includes("reggae")) return "Reggae"
  if (c.includes("blues") || c.includes("rhythm&blues")) return "Blues"
  if (c.includes("latin")) return "Latin"
  if (c.includes("rock") || c.includes("rock&roll") || c.includes("metal")) return "Power"

  return "PopOpen"
}

// ---------------------------------------------------------------------------
// Constants (GuitarVoicingTransform.cpp, anonymous namespace)
// ---------------------------------------------------------------------------

// Notes >= this MIDI number are MegaVoice trigger / noise lane -- articulation
// keys, not pitched chord tones. Never deleted, replaced or transposed. Same
// as FX_PITCH_MIN (83) + 1.
const kMegaVoiceTriggerNoteLo = FX_PITCH_MIN + 1 // 84

// Notes <= this are "bass-only" register; strokes entirely within it are
// never reshaped.
const kBassRegionTopMidi = 47

// Funk grips sit in a middle guitar pocket (avoids muddy opens and a
// too-bright top).
const kFunkGripFloorMidi = 54 // F#3
const kFunkGripCeilMidi = 71 // B4
const kFunkMinGripInterval = 3 // no semitone / whole-tone rubs
const kFunkAccentNoteBeats = 0.16
const kFunkBodyNoteBeats = 0.105
const kFunkGhostNoteBeats = 0.055
const kFunkMinSlideSourceBeats = 0.2
const kFunkSlideNoteBeats = 0.5 // 1/8 - minimum slide ring
const kFunkSlapAmpOpenVelocities = [30, 40]
const kFunkSlapAmpSlapVelocities = [50, 60]
const kFunkSlapAmpDeadVelocity = 61
const kFunkSlapAmpMuteVelocities = [77, 80]

const kPowerRootFloorMidi = 36 // C2
const kPowerRootCeilMidi = 47 // B2
const kPowerMaxNoteBeats = 0.28
const kPowerFifthLagBeats = 0.03

const kReferenceMuteVelocityLo = 76
const kReferenceMuteVelocityHi = 90

// Notes within this many beats of a stroke's first note count as the same
// stroke (simultaneous strum).
const kStrokeWindowBeats = 0.15

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

function mod12(x: number): number {
  return ((x % 12) + 12) % 12
}

function clampVelocity(v: number): number {
  return Math.max(1, Math.min(127, Math.round(v)))
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ---------------------------------------------------------------------------
// Chord quality parsing — port of HarmonicContract::parseChordSymbol,
// restricted to the quality suffix (root pitch class comes from
// ChordEvent.root, already resolved by the caller).
// ---------------------------------------------------------------------------

export type ParsedChordQuality = {
  valid: boolean
  rootPc: number
  /** 4 = major, 3 = minor, -1 = sus (no third). */
  thirdSemis: number
  /** 6 = dim, 7 = perfect, 8 = aug. */
  fifthSemis: number
  /** -1 = none, 9 = dim7, 10 = b7 (dominant), 11 = maj7. */
  seventhSemis: number
  sus2: boolean
  sus4: boolean
}

function normalizeNoteSpelling(s: string): string {
  return s.replace(/♭/g, "b").replace(/♯/g, "#") // flat / sharp glyphs
}

function rootTokenFromSymbol(symbol: string): string {
  const s = normalizeNoteSpelling(symbol.trim())
  if (s.length === 0) return ""
  let root = s[0]
  if (s.length > 1 && (s[1] === "#" || s[1] === "b" || s[1] === "B")) {
    root += s[1] === "B" ? "b" : s[1]
  }
  return root
}

function tokenLooksLikeNoteName(token: string): boolean {
  const t = normalizeNoteSpelling(token.trim())
  if (t.length === 0) return false
  const first = t[0].toUpperCase()
  return first === "A" || first === "B" || first === "C" || first === "D" || first === "E" || first === "F" || first === "G"
}

/**
 * Port of HarmonicContract::parseChordSymbol, minus root-pitch-class
 * derivation (the caller supplies rootPc from ChordEvent.root, which is
 * already transposed into the target key).
 */
export function parseChordQuality(rawName: string, rootPc: number): ParsedChordQuality {
  const out: ParsedChordQuality = {
    valid: false,
    rootPc: mod12(rootPc),
    thirdSemis: 4,
    fifthSemis: 7,
    seventhSemis: -1,
    sus2: false,
    sus4: false,
  }

  const name = normalizeNoteSpelling(rawName.trim())
  if (name.length === 0) return out

  let head = name
  const slash = name.indexOf("/")
  if (slash >= 0) {
    const right = name.slice(slash + 1).trim()
    if (tokenLooksLikeNoteName(right)) head = name.slice(0, slash).trim()
  }

  const rootTok = rootTokenFromSymbol(head)
  if (rootTok.length === 0) return out

  out.valid = true

  const qRaw = head.slice(rootTok.length).trim()
  const q = qRaw.toLowerCase().replace(/\s/g, "").replace(/_/g, "")

  const hasUpperM7 = qRaw.includes("M7") || qRaw.includes("M9") || qRaw.includes("Δ")
  const startsUpperMajor = qRaw.startsWith("M") && !qRaw.startsWith("m")
  const isHalfDim = q.includes("m7b5") || q.includes("m7(b5)") || q.includes("ø")
  const isDim7 = q.includes("dim7") || q.includes("o7") || q.includes("°7")
  const isDim = isHalfDim || isDim7 || q.includes("dim") || q === "o" || q.includes("°")
  const isAug = q.includes("aug") || q.includes("+")
  const isSus2 = q.includes("sus2")
  const isSus4 = !isSus2 && (q.includes("sus4") || q === "sus" || q.includes("7sus"))

  const isMaj7 = hasUpperM7 || q.includes("maj7") || q.includes("major7") || q.includes("maj9") || q.includes("major9")
  const startsMinor =
    (q.startsWith("min") || qRaw.startsWith("m") || qRaw.startsWith("-")) &&
    !q.startsWith("maj") &&
    !q.startsWith("major") &&
    !startsUpperMajor
  const isMinor = isHalfDim || isDim || startsMinor

  if (isSus2) {
    out.sus2 = true
    out.thirdSemis = -1
  }
  if (isSus4) {
    out.sus4 = true
    out.thirdSemis = -1
  }
  if (!out.sus2 && !out.sus4) out.thirdSemis = isMinor ? 3 : 4

  if (isHalfDim || isDim) out.fifthSemis = 6
  else if (isAug) out.fifthSemis = 8
  else out.fifthSemis = 7

  const add9Only = q === "(9)" || q === "add9" || q === "add2" || q === "2"
  const hasDominantSeventh =
    !isMaj7 &&
    !add9Only &&
    (q === "7" || q.includes("7") || q === "9" || q === "11" || q === "13" || q.startsWith("7(") || q.startsWith("7b") || q.startsWith("7#"))

  if (isMaj7) out.seventhSemis = 11
  else if (isDim7) out.seventhSemis = 9
  else if (hasDominantSeventh) out.seventhSemis = 10

  return out
}

// ---------------------------------------------------------------------------
// Chord-block timeline (port of parseChordTimings / chordAtBeat, fed
// directly from ChordEvent[] instead of chordTimingsJson).
// ---------------------------------------------------------------------------

type ChordBlock = {
  startBeat: number
  endBeat: number
  chord: ParsedChordQuality
}

function buildChordBlocks(chords: ChordEvent[]): ChordBlock[] {
  const blocks: ChordBlock[] = []
  for (const c of chords) {
    const chord = parseChordQuality(c.name, c.root)
    if (!chord.valid) continue
    const dur = Math.max(0.05, c.durationBeats)
    blocks.push({ startBeat: c.startBeat, endBeat: c.startBeat + dur, chord })
  }

  blocks.sort((a, b) => a.startBeat - b.startBeat)

  // Patch end beats to the next block's start when there's overlap.
  for (let i = 0; i + 1 < blocks.length; i++) {
    blocks[i].endBeat = Math.min(blocks[i].endBeat, blocks[i + 1].startBeat)
  }

  return blocks
}

function chordBlockAtBeat(blocks: ChordBlock[], beat: number): ChordBlock | null {
  let best: ChordBlock | null = null
  for (const b of blocks) {
    if (beat + 1e-6 >= b.startBeat && beat < b.endBeat + 1e-6) return b
    if (best === null && beat >= b.startBeat) best = b
  }
  return best
}

// ---------------------------------------------------------------------------
// Stroke detection (port of collectStrokes and the small stroke-query
// helpers).
// ---------------------------------------------------------------------------

type Stroke = {
  startBeat: number
  notes: NoteEvent[] // sorted by pitch ascending
}

/** Splits `events` into (megavoice-trigger notes untouched) + (strokes). */
function collectStrokes(events: NoteEvent[]): { strokes: Stroke[]; fx: NoteEvent[] } {
  const fx: NoteEvent[] = []
  const pitched: NoteEvent[] = []
  for (const e of events) {
    if (e.note > FX_PITCH_MIN) fx.push(e)
    else pitched.push(e)
  }

  const sorted = [...pitched].sort((a, b) => a.beat - b.beat)

  const strokes: Stroke[] = []
  for (const n of sorted) {
    const last = strokes.length > 0 ? strokes[strokes.length - 1] : null
    if (last !== null && Math.abs(n.beat - last.startBeat) < kStrokeWindowBeats) {
      last.notes.push(n)
    } else {
      strokes.push({ startBeat: n.beat, notes: [n] })
    }
  }

  for (const s of strokes) s.notes.sort((a, b) => a.note - b.note)

  return { strokes, fx }
}

function strokeIsBassOnly(stroke: Stroke): boolean {
  if (stroke.notes.length === 0) return false
  return stroke.notes.every((n) => n.note <= kBassRegionTopMidi)
}

function peakVelocity(notes: NoteEvent[]): number {
  let v = 0
  for (const n of notes) v = Math.max(v, n.velocity)
  return clampVelocity(v)
}

/** Longest note end (beat + duration) across the stroke; port of longestEndBeat. */
function strokeEndBeat(stroke: Stroke): number {
  let e = stroke.startBeat + 0.25
  for (const n of stroke.notes) e = Math.max(e, n.beat + n.durationBeats)
  return e
}

function hasUpperNotes(stroke: Stroke): boolean {
  return stroke.notes.some((n) => n.note > kBassRegionTopMidi)
}

function isDeadBandVelocity(velocity: number): boolean {
  // SolidGuitar1/CleanGuitar source dead band used by the imports.
  return velocity >= 61 && velocity <= 75
}

function isMuteBandVelocity(velocity: number): boolean {
  return velocity >= 76 && velocity <= 90
}

/** True when every upper-region note of the stroke sits in the dead band. */
function strokeIsDeadChuck(stroke: Stroke): boolean {
  let upperCount = 0
  for (const n of stroke.notes) {
    if (n.note <= kBassRegionTopMidi) continue
    if (!isDeadBandVelocity(n.velocity)) return false
    upperCount++
  }
  return upperCount > 0
}

function strokeHasSourceDeadOrMuteArticulation(stroke: Stroke): boolean {
  for (const n of stroke.notes) {
    if (n.note <= kBassRegionTopMidi) continue
    if (isDeadBandVelocity(n.velocity) || isMuteBandVelocity(n.velocity)) return true
  }
  return false
}

function looksLikeFullStrum(stroke: Stroke): boolean {
  if (stroke.notes.length < 4) return false
  const upperCount = stroke.notes.filter((n) => n.note > kBassRegionTopMidi).length
  return upperCount >= 4
}

function referenceMuteVelocityForStroke(stroke: Stroke): number {
  let peakUpper = 1
  for (const n of stroke.notes) {
    if (n.note > kBassRegionTopMidi) peakUpper = Math.max(peakUpper, n.velocity)
  }
  const normalised = (clampInt(peakUpper, 1, 127) - 1) / 126
  return kReferenceMuteVelocityLo + Math.round(normalised * (kReferenceMuteVelocityHi - kReferenceMuteVelocityLo))
}

function beatSixteenthIndex(beat: number): number {
  return Math.floor(beat * 4 + 0.5) & 15
}

function beatEighthIndex(beat: number): number {
  return Math.floor(beat * 2 + 0.5) & 7
}

function powerReferenceVelocity(rankFromLow: number, sixteenth: number): number {
  const slot = (sixteenth >> 1) & 3
  const softer = slot === 0 || slot === 3
  const rootVelocity = softer ? 43 : slot === 1 ? 80 : 86
  const fifthVelocity = softer ? 27 : slot === 1 ? 76 : 81
  return rankFromLow === 0 ? rootVelocity : fifthVelocity
}

/** Place a target pitch class as close as possible to a reference MIDI note. */
function placePcNearReference(pcIn: number, referenceMidi: number, floorMidi = 36, ceilMidi = 83): number {
  const pc = mod12(pcIn)
  const refOctave = Math.trunc(referenceMidi / 12)
  let best = pc + 12 * refOctave
  let bestDist = Math.abs(best - referenceMidi)
  for (let oct = -2; oct <= 2; oct++) {
    const candidate = pc + 12 * (refOctave + oct)
    const d = Math.abs(candidate - referenceMidi)
    if (d < bestDist) {
      best = candidate
      bestDist = d
    }
  }
  return clampInt(best, floorMidi, ceilMidi)
}

function placePcInPowerRootRange(pcIn: number): number {
  const pc = mod12(pcIn)
  let best = -1
  let bestDist = Number.POSITIVE_INFINITY
  for (let pitch = pc; pitch <= kPowerRootCeilMidi; pitch += 12) {
    if (pitch < kPowerRootFloorMidi) continue
    const d = Math.abs(pitch - 40)
    if (best < 0 || d < bestDist) {
      best = pitch
      bestDist = d
    }
  }
  return best >= 0 ? best : kPowerRootFloorMidi
}

/**
 * Place a pitch class inside the funk grip register (54..71), as close as
 * possible to `referenceMidi`, skipping any candidate closer than
 * kFunkMinGripInterval semitones to an existing pitch. Returns null when no
 * candidate fits (port of placePcInFunkGripAvoidingCloseIntervals, which
 * returns -1 in the C++ for the same case).
 */
function placePcInFunkGripAvoidingCloseIntervals(pcIn: number, referenceMidi: number, existing: number[]): number | null {
  const pc = mod12(pcIn)
  const candidates: number[] = []
  for (let pitch = pc; pitch <= kFunkGripCeilMidi; pitch += 12) {
    if (pitch >= kFunkGripFloorMidi) candidates.push(pitch)
  }
  candidates.sort((a, b) => Math.abs(a - referenceMidi) - Math.abs(b - referenceMidi))
  for (const candidate of candidates) {
    if (existing.every((e) => Math.abs(candidate - e) >= kFunkMinGripInterval)) return candidate
  }
  return null
}

// 32-bit FNV-1a, matching GuitarVoicingTransform.cpp's inline hash (uint32_t
// arithmetic, wrapping multiply). Math.imul gives the required 32-bit wrap;
// `>>> 0` keeps the accumulator unsigned between steps, mirroring uint32_t.
function fnv1a(values: number[]): number {
  let h = 2166136261 >>> 0
  for (const v of values) {
    h = (h ^ (v >>> 0)) >>> 0
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

function funkReferenceRhythmVelocity(rankFromLow: number, voicedCount: number, sixteenth: number, strokeStart: number, pitch: number): number {
  const sub = sixteenth % 4
  const h = fnv1a([Math.round(strokeStart * 960), pitch, rankFromLow])

  if (sub === 1 || sub === 3) return kFunkSlapAmpMuteVelocities[h % 2]
  if (rankFromLow === 0 && voicedCount > 1) return kFunkSlapAmpDeadVelocity
  if (sub === 0) return kFunkSlapAmpSlapVelocities[h % 2]

  return ((h >>> 8) % 4) === 0 ? kFunkSlapAmpOpenVelocities[h % 2] : kFunkSlapAmpSlapVelocities[h % 2]
}

function funkReferenceSlideVelocityFor(strokeStart: number, pitch: number): number {
  const h = fnv1a([Math.round(strokeStart * 960), pitch])
  return 106 + (h % 15)
}

function funkNoteLengthBeats(sixteenth: number): number {
  const sub = sixteenth % 4
  if (sub === 0) return kFunkAccentNoteBeats
  if (sub === 2) return kFunkBodyNoteBeats
  return kFunkGhostNoteBeats
}

/**
 * The colour tone for a funk shell: the chord-spelled 7th if the chord
 * already has one, b7 for a plain minor (m7 feel), or the 6th for a plain
 * major (C6 feel) -- this is the rule the header explicitly calls out as
 * deliberately avoiding a forced dominant sound on every major chord. Port
 * of colourPitchClassForChord's fallback branch (preferThirteen=false; the
 * `preferThirteen` alternate branch belongs to applyColourVariations'
 * randomised variety feature, which is out of scope here).
 */
function colourPitchClassForChord(chord: ParsedChordQuality): number {
  if (chord.seventhSemis >= 0) return mod12(chord.rootPc + chord.seventhSemis)
  return mod12(chord.rootPc + (chord.thirdSemis === 3 ? 10 : 9))
}

// ---------------------------------------------------------------------------
// Per-style transforms (port of the per-style functions in
// GuitarVoicingTransform.cpp's "Per-style transforms" section).
//
// Each takes a Stroke + the active chord and returns the REPLACEMENT note
// list for that stroke (the C++ mutates the sequence in place via
// markForDelete/addNote; here we just build the new array). Any note not
// mentioned as removed is implicitly a straight copy of the original --
// beat/velocity/duration untouched -- which is how the "never change the
// timing of a stroke" and "notes above FX_PITCH_MIN pass through unchanged"
// rules stay true even for styles that only add or drop notes.
// ---------------------------------------------------------------------------

function applyPower(stroke: Stroke, chord: ParsedChordQuality): NoteEvent[] {
  if (strokeIsDeadChuck(stroke)) return stroke.notes

  const root = placePcInPowerRootRange(chord.rootPc)
  const fifth = root + 7
  const sixteenth = beatSixteenthIndex(stroke.startBeat)
  const rootStart = stroke.startBeat
  const fifthStart = stroke.startBeat + kPowerFifthLagBeats
  const clippedEnd = Math.min(strokeEndBeat(stroke), stroke.startBeat + kPowerMaxNoteBeats)

  return [
    {
      beat: rootStart,
      note: root,
      velocity: powerReferenceVelocity(0, sixteenth),
      durationBeats: Math.max(0.02, clippedEnd - rootStart),
    },
    {
      beat: fifthStart,
      note: fifth,
      velocity: powerReferenceVelocity(1, sixteenth),
      durationBeats: Math.max(0.02, clippedEnd + kPowerFifthLagBeats - fifthStart),
    },
  ]
}

function applyReggae(stroke: Stroke): NoteEvent[] {
  // Keep only the top 3 notes (highest pitches); drop the rest.
  if (stroke.notes.length <= 3) return stroke.notes
  return stroke.notes.slice(stroke.notes.length - 3)
}

function applyLatin(stroke: Stroke, chord: ParsedChordQuality): NoteEvent[] {
  // Keep one bass note (root in low register) + top three. Drop the middle.
  // If there's no explicit bass note in the stroke, lower the lowest note to
  // the chord root in the bass region.
  const n = stroke.notes.length
  if (n < 4) return stroke.notes

  const lowest = stroke.notes[0]
  const top3 = stroke.notes.slice(n - 3)

  const out: NoteEvent[] = []
  if (lowest.note > kBassRegionTopMidi) {
    // Lowest is too high for a Latin spread -- replace with chord root in bass.
    const rootBass = placePcNearReference(chord.rootPc, 43, 36, 50) // ~G2..A#2
    out.push({
      beat: stroke.startBeat,
      note: rootBass,
      velocity: clampVelocity(peakVelocity(stroke.notes) - 10),
      durationBeats: strokeEndBeat(stroke) - stroke.startBeat,
    })
  } else {
    out.push(lowest)
  }
  out.push(...top3)
  return out
}

function applyBlues(stroke: Stroke, chord: ParsedChordQuality): NoteEvent[] {
  // Add b7 if the chord is major-quality and doesn't already have a 7th.
  if (chord.thirdSemis !== 4) return stroke.notes // minor chords already imply m7 in blues
  if (chord.seventhSemis === 11) return stroke.notes // already maj7 -- leave it

  const b7 = mod12(chord.rootPc + 10)
  if (stroke.notes.some((n) => mod12(n.note) === b7)) return stroke.notes

  const top = stroke.notes[stroke.notes.length - 1].note
  const b7Pitch = placePcNearReference(b7, top + 3, top, 80)

  return [
    ...stroke.notes,
    {
      beat: stroke.startBeat,
      note: b7Pitch,
      velocity: clampVelocity(peakVelocity(stroke.notes) - 8),
      durationBeats: strokeEndBeat(stroke) - stroke.startBeat,
    },
  ]
}

function applyJazz(stroke: Stroke, chord: ParsedChordQuality): NoteEvent[] {
  // Drop-2 voicing: for a sus chord we can't easily drop-2; no-op instead.
  if (chord.thirdSemis < 0) return stroke.notes

  const vel = peakVelocity(stroke.notes)
  const sB = stroke.startBeat
  const eB = strokeEndBeat(stroke)
  const dur = Math.max(0.02, eB - sB)

  // Anchor R around C4 (60); derive everything else from there. Numerically
  // this always lands low-to-high as 5(dropped) - R - 3 - 7 (the C++'s own
  // inline comments say this; the header's prose line says "R-5-7-3", which
  // doesn't match the arithmetic -- the code, not that one line of prose, is
  // the port target).
  const rootMidi = placePcNearReference(chord.rootPc, 60)
  const third = rootMidi + chord.thirdSemis
  const seventh = rootMidi + (chord.seventhSemis >= 0 ? chord.seventhSemis : chord.thirdSemis === 4 ? 11 : 10)
  const fifthLow = rootMidi + chord.fifthSemis - 12 // dropped octave

  return [
    { beat: sB, note: fifthLow, velocity: clampVelocity(vel - 4), durationBeats: dur },
    { beat: sB, note: rootMidi, velocity: vel, durationBeats: dur },
    { beat: sB, note: third, velocity: clampVelocity(vel - 2), durationBeats: dur },
    { beat: sB, note: seventh, velocity: clampVelocity(vel - 4), durationBeats: dur },
  ]
}

/**
 * Reassigns velocity + duration on the stroke's upper notes to the funk
 * rhythm/slide model: deterministic hashed velocity bands per sixteenth-note
 * slot, staccato-clipped short chinks, and a full-chord "slide" band on
 * qualifying bar downbeats. Pure port of applyFunkReferenceStroke -- pitch
 * content is untouched here.
 */
function applyFunkReferenceStroke(stroke: Stroke): NoteEvent[] {
  const upperIdx: number[] = []
  stroke.notes.forEach((n, i) => {
    if (n.note > kBassRegionTopMidi) upperIdx.push(i)
  })
  if (upperIdx.length === 0) return stroke.notes

  const upperSorted = [...upperIdx].sort((a, b) => stroke.notes[a].note - stroke.notes[b].note)
  const sixteenth = beatSixteenthIndex(stroke.startBeat)
  const voicedCount = upperSorted.length

  let minDur = Number.POSITIVE_INFINITY
  let maxDur = 0
  for (const idx of upperSorted) {
    const d = Math.max(0, stroke.notes[idx].durationBeats)
    minDur = Math.min(minDur, d)
    maxDur = Math.max(maxDur, d)
  }

  const uniformHeldChord = voicedCount >= 2 && minDur >= kFunkMinSlideSourceBeats && minDur >= 0.6 * maxDur
  const barIndex = Math.floor(stroke.startBeat / 4)
  const slideBar = ((barIndex % 2) + 2) % 2 === 1 // every second bar
  const slideStroke = sixteenth === 0 && uniformHeldChord && slideBar

  const result = [...stroke.notes]
  upperSorted.forEach((idx, i) => {
    const n = stroke.notes[idx]
    const duration = Math.max(0, n.durationBeats)

    if (slideStroke) {
      const velocity = funkReferenceSlideVelocityFor(n.beat, n.note)
      const newDuration = Math.max(duration, kFunkSlideNoteBeats, 0.02)
      result[idx] = { ...n, velocity: clampVelocity(velocity), durationBeats: newDuration }
    } else {
      const velocity = funkReferenceRhythmVelocity(i, voicedCount, sixteenth, n.beat, n.note)
      // Tighten only short chink notes into a staccato chop; leave genuinely
      // long source notes at their full length.
      const newDuration = duration < kFunkMinSlideSourceBeats ? Math.max(funkNoteLengthBeats(sixteenth), 0.02) : duration
      result[idx] = { ...n, velocity: clampVelocity(velocity), durationBeats: newDuration }
    }
  })
  return result
}

/**
 * Funk shell voicing + articulation.
 *
 * PORTING NOTE (read before touching this function): the current
 * GuitarVoicingTransform.cpp `applyFunk()` calls ONLY
 * applyFunkReferenceStroke() -- i.e. at runtime it re-articulates whatever
 * pitches are already in the stroke; it does not itself add the "3 + colour
 * (+9)" shell tones the header describes. On desktop that's fine because the
 * shell pitches are baked into the funk clip's MIDI ahead of time by a
 * separate content-authoring pass (applyColourVariations /
 * revoiceFunkOutOfRangeNotes, invoked from the Python library-import
 * scripts) -- by the time a user picks a funk clip, the notes are already
 * voiced correctly and apply() only needs to shape dynamics.
 *
 * The web Jam Player's arrangement pipeline has no equivalent
 * library-authoring bake step, and the porting brief's own test list
 * requires Funk to *produce* the documented "3 + colour" shell with its
 * exact colour rule (chord 7th if spelled, b7 for plain minor, 6th for
 * plain major). So this port assembles that shell live, using the exact
 * same helper functions and constants the .cpp defines for it
 * (colourPitchClassForChord, placePcInFunkGripAvoidingCloseIntervals,
 * kFunkGripFloorMidi/CeilMidi/MinGripInterval) but which the current .cpp
 * only wires into the content-authoring path -- then runs the same
 * articulation pass (applyFunkReferenceStroke) the runtime path uses. This
 * is a deliberate, explicitly-flagged adaptation to cover for the missing
 * pipeline stage, not a redesign of the shell rule or the articulation
 * model, both of which are ported verbatim.
 */
function applyFunk(stroke: Stroke, chord: ParsedChordQuality): NoteEvent[] {
  if (chord.thirdSemis < 0) return stroke.notes // sus -> leave as-is

  // A muted chuck is a percussive scratch -- its pitch is inaudible, so
  // re-voicing it is pointless and would push its velocity out of the dead
  // band into a ringing strum.
  if (strokeIsDeadChuck(stroke)) return stroke.notes

  const upperOriginal = stroke.notes.filter((n) => n.note > kBassRegionTopMidi)
  const wantNinth = upperOriginal.length >= 3 // strokes with >=3 ORIGINAL upper notes also get the 9

  const thirdPcVal = mod12(chord.rootPc + chord.thirdSemis)
  const colourPcVal = colourPitchClassForChord(chord)
  const wantedPcs = [thirdPcVal, colourPcVal]
  if (wantNinth) wantedPcs.push(mod12(chord.rootPc + 2))

  const anchor = upperOriginal.length > 0 ? Math.max(...upperOriginal.map((n) => n.note)) : Math.round((kFunkGripFloorMidi + kFunkGripCeilMidi) / 2)

  const seedVelocity = peakVelocity(stroke.notes)
  const seedDuration = upperOriginal.length > 0 ? upperOriginal[0].durationBeats : kFunkBodyNoteBeats

  const placedPitches = upperOriginal.map((n) => n.note)
  const shellNotes: NoteEvent[] = []
  for (const pc of wantedPcs) {
    if (placedPitches.some((p) => mod12(p) === pc)) continue // already present -- don't stack duplicates
    const placed = placePcInFunkGripAvoidingCloseIntervals(pc, anchor, placedPitches)
    if (placed === null) continue // no legal grip slot -- skip rather than force a clash
    placedPitches.push(placed)
    shellNotes.push({ beat: stroke.startBeat, note: placed, velocity: seedVelocity, durationBeats: seedDuration })
  }

  const withShell: Stroke = { startBeat: stroke.startBeat, notes: [...stroke.notes, ...shellNotes] }
  return applyFunkReferenceStroke(withShell)
}

function applyMuted(stroke: Stroke): NoteEvent[] {
  const v = clampVelocity(referenceMuteVelocityForStroke(stroke))
  return stroke.notes.map((n) => (n.note > kBassRegionTopMidi ? { ...n, velocity: v } : n))
}

function transformStroke(stroke: Stroke, chord: ParsedChordQuality, style: VoicingStyle): NoteEvent[] {
  switch (style) {
    case "None":
    case "PopOpen":
      return stroke.notes // intentional no-op
    case "Muted":
      return stroke.notes // preserve shape; handled by the Muted fast path in applyGuitarVoicing
    case "Power":
      return applyPower(stroke, chord)
    case "Funk":
      return applyFunk(stroke, chord)
    case "Jazz":
      return applyJazz(stroke, chord)
    case "Reggae":
      return applyReggae(stroke)
    case "Latin":
      return applyLatin(stroke, chord)
    case "Blues":
      return applyBlues(stroke, chord)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply the voicing transform to a rhythm-guitar note stream. Pure: returns
 * a new array, never mutates `events`.
 *
 * `chords` must already be in the song's playing key (the caller is
 * responsible for transposition) -- the desktop equivalent expects the
 * sequence to have already been run through the chord adapter; the same
 * precondition applies here to `events`.
 *
 * Port of GuitarVoicingTransform::apply.
 */
export function applyGuitarVoicing(events: NoteEvent[], style: VoicingStyle, chords: ChordEvent[]): NoteEvent[] {
  if (style === "None" || style === "PopOpen") return [...events]
  if (events.length === 0) return [...events]

  const { strokes, fx } = collectStrokes(events)
  if (strokes.length === 0) return [...events]

  if (style === "Muted") {
    const outNotes = strokes.flatMap((s) => applyMuted(s))
    return [...fx, ...outNotes].sort((a, b) => a.beat - b.beat)
  }

  const blocks = buildChordBlocks(chords)
  if (blocks.length === 0) return [...events]

  const outNotes: NoteEvent[] = []
  for (const s of strokes) {
    const block = chordBlockAtBeat(blocks, s.startBeat)
    if (block === null) {
      outNotes.push(...s.notes)
      continue
    }
    if (strokeIsBassOnly(s)) {
      // Never reshape pure-bass strikes.
      outNotes.push(...s.notes)
      continue
    }
    if (style !== "Funk" && strokeHasSourceDeadOrMuteArticulation(s)) {
      outNotes.push(...s.notes)
      continue
    }
    outNotes.push(...transformStroke(s, block.chord, style))
  }

  return [...fx, ...outNotes].sort((a, b) => a.beat - b.beat)
}

/**
 * Tags existing rhythm-guitar strokes with reference SolidGuitar1 MegaVoice
 * technique velocities, independent of the structural re-voicing above.
 * Pure: returns a new array, never mutates `events`.
 *
 * Port of GuitarVoicingTransform::applyTechniqueVelocities.
 */
export function applyGuitarTechniqueVelocities(events: NoteEvent[], style: VoicingStyle, chords: ChordEvent[], protectStrums = false): NoteEvent[] {
  if (style === "None" || style === "PopOpen") return [...events]
  if (events.length === 0) return [...events]

  const blocks = buildChordBlocks(chords)
  if (blocks.length === 0) return [...events]

  const { strokes, fx } = collectStrokes(events)
  if (strokes.length === 0) return [...events]

  const outNotes: NoteEvent[] = []
  for (const s of strokes) {
    const block = chordBlockAtBeat(blocks, s.startBeat)
    if (block === null || s.notes.length === 0 || !hasUpperNotes(s)) {
      outNotes.push(...s.notes)
      continue
    }
    if (strokeHasSourceDeadOrMuteArticulation(s)) {
      outNotes.push(...s.notes)
      continue
    }
    if (protectStrums && looksLikeFullStrum(s)) {
      outNotes.push(...s.notes)
      continue
    }
    outNotes.push(...applyStrokeTechnique(s, style))
  }

  return [...fx, ...outNotes].sort((a, b) => a.beat - b.beat)
}

function applyStrokeTechnique(stroke: Stroke, style: VoicingStyle): NoteEvent[] {
  switch (style) {
    // Funk articulation is a single authority handled entirely in
    // applyGuitarVoicing's applyFunk -> applyFunkReferenceStroke pass;
    // touching velocity again here would clobber the slide band.
    case "Funk":
      return stroke.notes

    case "Power":
      return applyPowerReferenceVelocities(stroke)

    case "Blues": {
      const eighth = beatEighthIndex(stroke.startBeat)
      if (eighth % 4 === 3 || eighth % 4 === 1) {
        // dead-note push into change / dead-note accent
        return stroke.notes.map((n) => ({ ...n, velocity: clampVelocity(68) }))
      }
      return stroke.notes
    }

    // Dead / muted chops were a voicing artefact, not the song -- drop them
    // for Reggae / Latin / Jazz so these strokes ring open. Only Power keeps
    // its palm-mute character (handled above).
    case "Reggae":
    case "Latin":
    case "Jazz":
    case "None":
    case "PopOpen":
    case "Muted":
      return stroke.notes
  }
}

function applyPowerReferenceVelocities(stroke: Stroke): NoteEvent[] {
  const voicedIdx: number[] = []
  stroke.notes.forEach((n, i) => {
    if (n.note >= kPowerRootFloorMidi && n.note <= kPowerRootCeilMidi + 7) voicedIdx.push(i)
  })
  if (voicedIdx.length === 0) return stroke.notes

  const sortedVoiced = [...voicedIdx].sort((a, b) => stroke.notes[a].note - stroke.notes[b].note)
  const sixteenth = beatSixteenthIndex(stroke.startBeat)

  const result = [...stroke.notes]
  sortedVoiced.forEach((idx, i) => {
    const velocity = powerReferenceVelocity(Math.min(i, 1), sixteenth)
    result[idx] = { ...stroke.notes[idx], velocity: clampVelocity(velocity) }
  })
  return result
}
