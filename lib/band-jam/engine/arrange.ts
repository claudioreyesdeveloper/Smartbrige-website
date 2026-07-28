/**
 * Jam Player arrangement engine.
 *
 * Pure, deterministic port of Smartbridge/scripts/band_jam_pilot/render_stems.py's
 * `assemble()` pipeline (and its helpers) to TypeScript. No I/O, no DOM, no Node
 * APIs — this runs in the browser and must produce byte-identical output for
 * identical input every time.
 *
 * Clip loading (SQLite + MIDI decode in Python) is NOT this module's job: the
 * caller passes pre-decoded clip events in via `clips`.
 *
 * See docs/jam-player-voice-engine.md section 3.3 for the MegaVoice FX rule
 * this file must honour: notes above FX_PITCH_MIN are noise/articulation
 * samples, not pitches, and must pass through `adaptHarmonic` /
 * `foldToRegister` completely untouched.
 */

import {
  applyGuitarVoicing,
  resolveAutoFromCategory,
  type VoicingStyle,
} from "@/lib/band-jam/engine/guitar-voicing"
import {
  BEATS_PER_BAR,
  FX_PITCH_MIN,
} from "./types"
import type {
  Arrangement,
  ArrangementSection,
  BandPart,
  BandStyle,
  ChartBar,
  ChartChord,
  ChordEvent,
  NoteEvent,
  PartEvents,
  Progression,
  ProgressionSection,
} from "./types"

/** Tolerance used throughout for beat-boundary comparisons (mirrors the Python 1e-6). */
const EPS = 1e-6

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

/** Positive-safe modulo (JS `%` can return negative values; Python's can't). */
function mod12(x: number): number {
  return ((x % 12) + 12) % 12
}

/**
 * Python's built-in `round()` uses round-half-to-even ("banker's rounding"),
 * unlike `Math.round`, which always rounds .5 up. `tileEvents` relies on
 * Python's `round()` for its bar-count estimate, so we replicate it exactly
 * to avoid off-by-one loop lengths on exact-half inputs. Only needs to handle
 * non-negative inputs (clip length in beats is always >= 0).
 */
function roundHalfEven(x: number): number {
  const floor = Math.floor(x)
  const diff = x - floor
  if (diff < 0.5) return floor
  if (diff > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}

// ---------------------------------------------------------------------------
// Core helpers — ported 1:1 from render_stems.py
// ---------------------------------------------------------------------------

/**
 * Loop `events` (a clip, in beats-from-clip-start) to fill `sectionBeats`,
 * truncating (never extending) notes that cross the section boundary.
 *
 * Port of `tile_events`. The clip's own loop length is estimated by rounding
 * its extent up to the nearest whole bar (minimum 1 bar) — this is what lets
 * a slightly-short recorded clip loop cleanly on bar boundaries.
 */
export function tileEvents(events: NoteEvent[], sectionBeats: number): NoteEvent[] {
  if (events.length === 0) return []

  let clipBeats = 0
  for (const e of events) {
    const end = e.beat + e.durationBeats
    if (end > clipBeats) clipBeats = end
  }
  const clipBars = Math.max(1, roundHalfEven(clipBeats / BEATS_PER_BAR))
  const loopBeats = clipBars * BEATS_PER_BAR

  const out: NoteEvent[] = []
  let offset = 0
  while (offset < sectionBeats - EPS) {
    for (const e of events) {
      const t = offset + e.beat
      if (t < sectionBeats - EPS) {
        out.push({
          beat: t,
          note: e.note,
          velocity: e.velocity,
          durationBeats: Math.min(e.durationBeats, sectionBeats - t),
        })
      }
    }
    offset += loopBeats
  }
  return out
}

/**
 * Shortest-path transposition (in semitones) from `srcPc` to `targetRoot`,
 * wrapping at +/-6. E.g. 0 -> 10 gives -2 (down two), not +10 (up ten).
 *
 * Port of `shift_for_root`.
 */
export function shiftForRoot(srcPc: number, targetRoot: number): number {
  let delta = mod12(targetRoot - srcPc)
  if (delta > 6) delta -= 12
  return delta
}

/**
 * Octave-fold `note` into the inclusive [lo, hi] register.
 *
 * Port of `fold_to_register`.
 */
export function foldToRegister(note: number, lo: number, hi: number): number {
  let n = note
  while (n < lo) n += 12
  while (n > hi) n -= 12
  return n
}

/**
 * Retune a clip's pitched notes to follow the chord roots active at each
 * note's beat, folding the result into `register`.
 *
 * CRITICAL: notes above FX_PITCH_MIN (83) are MegaVoice FX/noise, not
 * pitches — they pass straight through, untouched (see module docs, and
 * docs/jam-player-voice-engine.md section 3.3). Getting this wrong turns
 * fret noise into pitched garbage on every key change.
 *
 * Port of `adapt_harmonic`.
 */
export function adaptHarmonic(
  events: NoteEvent[],
  srcKeyPc: number,
  chords: ChordEvent[],
  register: [number, number],
): NoteEvent[] {
  const [lo, hi] = register
  const out: NoteEvent[] = []
  for (const e of events) {
    if (e.note > FX_PITCH_MIN) {
      // FX/noise sample — pass through completely untouched.
      out.push(e)
      continue
    }
    let root: number | null = null
    for (const ch of chords) {
      if (ch.startBeat - EPS <= e.beat && e.beat < ch.startBeat + ch.durationBeats) {
        root = ch.root
        break
      }
    }
    if (root === null) {
      root = chords.length > 0 ? chords[0].root : srcKeyPc
    }
    const shifted = foldToRegister(e.note + shiftForRoot(srcKeyPc, root), lo, hi)
    out.push({ beat: e.beat, note: shifted, velocity: e.velocity, durationBeats: e.durationBeats })
  }
  return out
}

// ---------------------------------------------------------------------------
// Chord-symbol transposition — parse root [+ /bass], shift, re-render
// ---------------------------------------------------------------------------

const NOTE_LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Fixed, deterministic enharmonic spelling table (no context-dependent respelling). */
/**
 * Enharmonic spelling is KEY-DEPENDENT. A single static table renders Bm7
 * transposed into D major as "Dbm7", which no musician would write — D major
 * has a sharp signature, so it must be "C#m7".
 *
 * Sharp-signature majors: G D A E B F#/C#. Everything else takes flats.
 * C major has no accidentals; flats are the conventional default there.
 */
const PC_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
const PC_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const SHARP_KEY_PCS = new Set([7, 2, 9, 4, 11, 6, 1])

/** Spelling table for a key. Falls back to flats when the key is unknown. */
function spellingFor(keyPc: number | undefined): string[] {
  if (keyPc === undefined) return PC_NAMES_FLAT
  return SHARP_KEY_PCS.has(mod12(keyPc)) ? PC_NAMES_SHARP : PC_NAMES_FLAT
}

function noteNameToPc(letter: string, accidental: string): number {
  let pc = NOTE_LETTER_PC[letter]
  if (accidental === "#") pc += 1
  else if (accidental === "b") pc -= 1
  return mod12(pc)
}

function pcToNoteName(pc: number, keyPc?: number): string {
  return spellingFor(keyPc)[mod12(pc)]
}

const CHORD_SYMBOL_RE = /^([A-G])([#b]?)(.*)$/
const SLASH_BASS_RE = /^(.*)\/([A-G])([#b]?)$/

/**
 * Transpose a chord symbol by `semitones`, preserving quality suffix and
 * slash-bass. E.g. transposeChordSymbol("FM7(9)/A", 2) -> "GM7(9)/B".
 *
 * Not present in the Python renderer (it never displays chord symbols — only
 * `root` as a pitch class), but required so the browser chart shows chord
 * symbols in the target key rather than the progression's home key.
 */
export function transposeChordSymbol(
  symbol: string,
  semitones: number,
  /** Target key pitch class, so accidentals are spelled to its signature. */
  targetKeyPc?: number,
): string {
  const m = CHORD_SYMBOL_RE.exec(symbol)
  if (!m) return symbol
  const [, letter, accidental, rest] = m

  let quality = rest
  let bassName: string | null = null
  const bassMatch = SLASH_BASS_RE.exec(rest)
  if (bassMatch) {
    quality = bassMatch[1]
    const bassPc = noteNameToPc(bassMatch[2], bassMatch[3])
    bassName = pcToNoteName(bassPc + semitones, targetKeyPc)
  }

  const rootPc = noteNameToPc(letter, accidental)
  const newRoot = pcToNoteName(rootPc + semitones, targetKeyPc)
  return newRoot + quality + (bassName !== null ? "/" + bassName : "")
}

// ---------------------------------------------------------------------------
// Chart bars — split a section's chords across bar boundaries
// ---------------------------------------------------------------------------

function buildSectionBars(
  section: ProgressionSection,
  transposedChords: ChordEvent[],
  firstBarNumber: number,
): ChartBar[] {
  const bars: ChartBar[] = []
  for (let b = 0; b < section.bars; b++) {
    const barStart = b * BEATS_PER_BAR
    const barEnd = barStart + BEATS_PER_BAR
    const chords: ChartChord[] = []
    for (const ch of transposedChords) {
      const chStart = ch.startBeat
      const chEnd = ch.startBeat + ch.durationBeats
      const start = Math.max(chStart, barStart)
      const end = Math.min(chEnd, barEnd)
      if (end - start > EPS) {
        chords.push({
          symbol: ch.name,
          beats: end - start,
          root: ch.root,
          bassRoot: ch.bassRoot,
        })
      }
    }
    bars.push({ barNumber: firstBarNumber + b, chords })
  }
  return bars
}

// ---------------------------------------------------------------------------
// assemble() — section / part / fill loop
// ---------------------------------------------------------------------------

export type ArrangeClipData = {
  events: NoteEvent[]
  sourceKeyPc: number
}

/**
 * Semitones the guitar drops after chord adaptation, PER STYLE.
 *
 * Rock and funk both drop an octave by ear: their source clips sit high in
 * the MegaVoice register and want to sit lower against the band. Everything
 * else stays at written pitch.
 *
 * IT IS NOT DERIVABLE, so do not try to infer it again. Yamaha style guitar
 * parts are written in a reference register and placed by the keyboard's
 * internal guitar tables (NTR=Guitar, NTT=GuitarStroke/Arpeggio on 82% of
 * these clips); those tables are not in the CASM chunk, whose note limits read
 * 0..127 for exactly this population. And the register itself does not
 * separate the styles either — measured medians of the source clips:
 *
 *     rock 65.0   funk 65.0   pop 65.0   swing-jazz 65.0
 *     reggae 67.0   blues 67.0   rnb 69.0   ballad 60.0
 *
 * Rock is identical to funk on paper. What makes either need a drop is how
 * they sit in the mix once the amp and band are on — a judgement made by ear.
 * So this is a hand-kept table, like style_overrides.json, and every entry
 * earns its place by listening.
 */
export const GUITAR_OCTAVE_SHIFT_BY_STYLE: Record<string, number> = {
  rock: 12,
  funk: 12,
  // Pitched funk comps (Smokin'Soul) sit high; drop one octave. Stroke notes
  // in 84–95 (FunkPopRock A/C) also drop — our SFZ plays that band as frets.
  // True one-shot noise keys (≥96) stay put.
  rnb: 12,
}

/**
 * After the style octave drop, funk open/high fretted notes still above this
 * stay an octave too high against the band (stroke 89–95 → 77–83). Pull them
 * into the same pocket as Smokin'Soul pitched comps (≈53–71).
 */
export const GUITAR_FUNK_POCKET_TOP = 71

/** Styles whose guitar is acoustic steel (see STYLE_ROLE_INSTRUMENTS). */
const STEEL_GUITAR_STYLES = new Set(["ballad", "country"])

/**
 * SteelGuitar MegaVoice open soft/med/hard tops out at velocity 60. Genos
 * ballad clips often write 61–70, which this voice maps to *dead* notes —
 * muted thuds mixed into open arpeggios read as broken chords. Clamp into
 * the open bands so dynamics survive without articulation flips.
 */
const STEEL_OPEN_VELOCITY_MAX = 60

/** Semitones to drop this style's guitar. 0 for anything not listed. */
export function guitarOctaveShift(styleId: string): number {
  return GUITAR_OCTAVE_SHIFT_BY_STYLE[styleId] ?? 0
}

/**
 * Genre re-voicing per style, from the desktop GuitarVoicingTransform port.
 *
 * OPT-IN. Genos / curated MegaVoice takes must not be reshaped — funk, rock,
 * and rnb are absent for that reason (Funk grip 54-71 was fighting the octave
 * drop). Blues / reggae / swing-jazz still use idiom transforms on library
 * material that benefits.
 *
 * A style's own `part.voicing` still wins when set explicitly.
 */
export const GUITAR_VOICING_BY_STYLE: Record<string, VoicingStyle> = {
  // Drop-2, 5-R-3-7. Archtop comping voiced off the low string.
  "swing-jazz": "Jazz",
  // Top three strings only — the skank has no business near the bass.
  reggae: "Reggae",
  // Forces the dominant 7th onto every stroke, which is the idiom.
  blues: "Blues",

  // DELIBERATELY ABSENT:
  //  - rock / funk / rnb: curated or high-pocket Genos — already voiced; do
  //    not re-grip (especially Funk 54-71).
  //  - pop / ballad / country: PopOpen no-op; listing would imply a transform.
}

/** Voicing for this style's guitar, or undefined for no transform. */
export function guitarVoicing(styleId: string): VoicingStyle | undefined {
  return GUITAR_VOICING_BY_STYLE[styleId]
}

/** Open low E. Nothing below this exists on a six-string. */
export const GUITAR_LOW_E = 40

/**
 * First MIDI note that stays as a one-shot noise key under the guitar octave
 * shift (not pulled into the fretted range).
 *
 * Yamaha MegaVoice marks FX above FX_PITCH_MIN (83), but the style clips —
 * especially FunkPopRock — put the actual *strummed string* material on
 * 86–95. SolidGuitar2 had pitched zones there; Emilyguitar's pitched range
 * only goes to 85, so those keys must octave-drop into fretted notes or the
 * part becomes nothing but scratch/noise. True one-shots start at 96
 * (Emily pickrest / high MegaVoice FX), which the web bundle maps onto
 * `noises/`.
 */
export const GUITAR_NOISE_KEY_MIN = 96

export type ArrangeInput = {
  /** Variation index (0 = A). Out-of-range values wrap per role. */
  variation?: number
  style: BandStyle
  progression: Progression
  keyPc: number
  tempo: number
  /** Pre-decoded clip events, keyed by clip id. Clip loading is not this module's job. */
  clips: Map<number, ArrangeClipData>
}

/**
 * Assemble a full arrangement: for every progression section, pick each
 * style part's clip (respecting `reuseClipId` overriding per-role slots),
 * tile it to fill the section, retune harmonic parts to the transposed chord
 * roots, splice in end-of-section fills, and lay everything onto one
 * continuous beat timeline. Also builds the bar/chord chart for the UI.
 *
 * Port of `assemble()`.
 */
export function arrange(input: ArrangeInput): Arrangement {
  const { style, progression, keyPc, tempo, clips } = input
  const variation = Math.max(0, Math.floor(input.variation ?? 0))
  // Feeds resolveAutoFromCategory, which is the desktop's "Auto" behaviour:
  // the voicing follows the style's genre unless a part pins it explicitly.
  const voicingCategory = style.category ?? style.name ?? style.id
  const transposePc = mod12(keyPc - progression.keyPc)

  const partNames = Object.keys(style.parts) as BandPart[]
  const partEventsMap: Partial<Record<BandPart, NoteEvent[]>> = {}
  for (const name of partNames) partEventsMap[name] = []

  const sections: ArrangementSection[] = []
  /** Clip ids referenced by the style but absent from the clip map. */
  const missing: number[] = []
  let cursorBeats = 0
  let barCursor = 1

  for (let sIdx = 0; sIdx < progression.sections.length; sIdx++) {
    const section = progression.sections[sIdx]
    const sectionBeats = section.bars * BEATS_PER_BAR

    const transposedChords: ChordEvent[] = section.chords.map((ch) => ({
      startBeat: ch.startBeat,
      durationBeats: ch.durationBeats,
      root: mod12(ch.root + transposePc),
      name: transposeChordSymbol(ch.name, transposePc, keyPc),
      bassRoot: ch.bassRoot !== undefined ? mod12(ch.bassRoot + transposePc) : undefined,
      roman: ch.roman,
    }))

    for (const partName of partNames) {
      const part = style.parts[partName]
      if (!part) continue

      // reuseClipId always wins over the per-role slot (matches render_stems.py:
      // `clip_id = reuse if reuse is not None else slot`), even for section
      // roles the part has no slot entry for at all.
      const reuse = part.reuseClipId
      // Variation A/B/C/D: pick the Nth ranked take for this role when the
      // export provided alternatives. variations[role][0] === slots[role], so
      // variation 0 is byte-identical to the previous behaviour. Wraps rather
      // than falling silent when a role has fewer takes than requested — a
      // style with 2 variations on one role and 4 on another should still play
      // when the user selects D.
      const takes = part.variations?.[section.role]
      const slot =
        takes && takes.length > 0
          ? takes[variation % takes.length]
          : part.slots[section.role]
      const clipId = reuse !== undefined ? reuse : slot
      if (clipId === undefined) {
        // Part isn't active on this section (e.g. solo only slotted on chorus).
        continue
      }

      const clipData = clips.get(clipId)
      if (!clipData) {
        // A missing clip means ONE part is silent for ONE section, not that the
        // arrangement is invalid. Throwing here blanked the whole practice
        // screen whenever the catalogue and clip exports were momentarily out
        // of step. Degrade instead: drop the part, keep the band playing.
        missing.push(clipId)
        continue
      }

      let events = tileEvents(clipData.events, sectionBeats)
      if (part.harmonic) {
        events = adaptHarmonic(events, clipData.sourceKeyPc, transposedChords, part.register ?? [28, 72])

        // Genre-aware re-voicing, ported from the desktop
        // GuitarVoicingTransform. Runs AFTER the chord adaptation, exactly as
        // the desktop runs it after its own chord adapter: adaptHarmonic gives
        // a piano-style closed triad, this rewrites each stroke the way a
        // guitarist would actually voice it for the genre.
        //
        // Guitar only, and only in styles that ask for it — see
        // GUITAR_OCTAVE_SHIFT_BY_STYLE.
        //
        // Skip true MegaVoice one-shot noise keys (≥ GUITAR_NOISE_KEY_MIN).
        // Do NOT use FX_PITCH_MIN (83) here: SolidGuitar2 still plays 86–95
        // as fretted zones, and FunkPopRock Variation A/C stroke notes live
        // there — skipping them left those takes an octave too high.
        const octaveShift =
          partName === "guitar" ? guitarOctaveShift(style.id) : 0
        if (octaveShift > 0) {
          events = events.map((e) => {
            if (e.note >= GUITAR_NOISE_KEY_MIN) return e
            let n = e.note - octaveShift
            // A flat octave shift can push an already-low clip below the
            // instrument. Rock variation C started at 36 and landed on 24 —
            // a whole octave under an open low E, which is boomy nonsense.
            // Fold back up rather than clamping, so the pitch class survives.
            while (n < GUITAR_LOW_E) n += 12
            // Funk open notes: stroke-register material (89–95) only drops to
            // 77–83 after one octave — still above the rhythm pocket. Drop
            // again so they sit with Smokin'Soul comps, not on the high E.
            if (
              style.id === "funk" &&
              n > GUITAR_FUNK_POCKET_TOP &&
              n < GUITAR_NOISE_KEY_MIN
            ) {
              n -= 12
              while (n < GUITAR_LOW_E) n += 12
            }
            return { ...e, note: n }
          })
        }

        // OPT-IN, not automatic. The desktop applies voicing to library
        // rhythm-guitar clips that have been through its chord adapter, which
        // snaps every note to the nearest chord tone and leaves a piano-style
        // closed triad — that genuinely needs re-voicing.
        //
        // Our guitar clips come straight out of Yamaha style files and are
        // ALREADY voiced for guitar by Yamaha, and adaptHarmonic only
        // root-follows rather than re-snapping, so the original shape survives.
        // Re-voicing on top is destructive: Power rewrote all four curated rock
        // templates to the same root-and-fifth pitch set, so variations A-D
        // became indistinguishable.
        //
        // The style's own `voicing` pins it; otherwise the per-style table
        // decides. Still opt-in — a style absent from both gets nothing.
        if (partName === "guitar") {
          const voicing = (part.voicing ??
            guitarVoicing(style.id)) as VoicingStyle
          if (voicing && voicing !== "None") {
            events = applyGuitarVoicing(events, voicing, transposedChords)
          }
        }

        // INSTRUMENT RANGE FLOOR — every style, unconditionally, and last.
        //
        // Nothing below an open low E exists on a six-string. This used to sit
        // inside the octave-shift block, which is rock-only, so the styles that
        // do NOT shift never got it: funk's source clips carry 42 notes between
        // MIDI 36 and 47, its register is [36, 83] which permits them, and they
        // went straight through and sounded an octave low.
        //
        // Fold up rather than clamp, so the pitch class survives. Runs after
        // the shift and the voicing because both can move notes downward.
        if (partName === "guitar") {
          events = events.map((e) => {
            if (e.note > FX_PITCH_MIN || e.note >= GUITAR_LOW_E) return e
            let n = e.note
            while (n < GUITAR_LOW_E) n += 12
            return { ...e, note: n }
          })

          // Drop MegaVoice noise-lane keys (≥96). Genos styles fire these
          // densely (often 20–35% of guitar events). On SteelGuitar they are
          // scrapes/slides; on Emilyguitar they hit muted/pickrest one-shots.
          // Either way they read as broken rattling in the web mix. Stroke
          // keys 84–95 are handled above (octave-drop into frets) and kept.
          events = events.filter((e) => e.note < GUITAR_NOISE_KEY_MIN)

          // Acoustic steel only: Genos ballad velocities often land in the
          // dead/mute bands (61–75). Clamp into open soft/med/hard (1–60).
          if (STEEL_GUITAR_STYLES.has(style.id)) {
            events = events.map((e) =>
              e.velocity > STEEL_OPEN_VELOCITY_MAX
                ? { ...e, velocity: STEEL_OPEN_VELOCITY_MAX }
                : e,
            )
          }
        }
      }

      const fills = part.fills
      if (fills && fills.atSectionEnd && section.bars >= fills.minSectionBars) {
        const fillId = fills.pool[sIdx % fills.pool.length]
        const fillClipData = clips.get(fillId)
        if (!fillClipData) {
          // Same reasoning as above: lose the fill, not the arrangement.
          missing.push(fillId)
          continue
        }
        const fillStart = sectionBeats - BEATS_PER_BAR
        events = events.filter((e) => e.beat < fillStart - EPS)
        // Fills must follow the chords too. Today only drums carry fills, and
        // drums are harmonic:false so this is a no-op — but if keys or guitar
        // ever get a fill pool, an unadapted fill would play in the clip's
        // recorded key over a transposed section. Guard it here rather than
        // discover it by ear later. (The Python original has the same gap.)
        let fillEvents = tileEvents(fillClipData.events, BEATS_PER_BAR)
        if (part.harmonic) {
          fillEvents = adaptHarmonic(
            fillEvents,
            fillClipData.sourceKeyPc,
            transposedChords,
            part.register ?? [28, 72],
          )
        }
        for (const e of fillEvents) {
          events.push({
            beat: fillStart + e.beat,
            note: e.note,
            velocity: e.velocity,
            durationBeats: e.durationBeats,
          })
        }
      }

      const target = partEventsMap[partName]!
      for (const e of events) {
        target.push({
          beat: cursorBeats + e.beat,
          note: e.note,
          velocity: e.velocity,
          durationBeats: e.durationBeats,
        })
      }
    }

    sections.push({
      role: section.role,
      label: section.label,
      startBar: barCursor,
      endBar: barCursor + section.bars - 1,
      bars: buildSectionBars(section, transposedChords, barCursor),
    })

    barCursor += section.bars
    cursorBeats += sectionBeats
  }

  const parts: PartEvents[] = partNames
    .filter((name) => (partEventsMap[name]?.length ?? 0) > 0)
    .map((name) => ({ part: name, events: partEventsMap[name]! }))

  const totalBars = barCursor - 1
  const totalBeats = totalBars * BEATS_PER_BAR

  if (missing.length > 0 && typeof console !== "undefined") {
    console.warn(
      `arrange: ${missing.length} clip(s) missing from the clip map, those ` +
        `parts are silent. Re-run export_clips.py. ids: ` +
        [...new Set(missing)].slice(0, 10).join(", "),
    )
  }

  return {
    styleId: style.id,
    progressionId: progression.id,
    keyPc,
    tempo,
    totalBars,
    totalBeats,
    parts,
    sections,
  }
}
