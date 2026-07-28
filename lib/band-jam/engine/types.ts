/**
 * Jam Player engine — shared contract.
 *
 * Everything downstream (SFZ parser, sampler, arrangement engine, chart UI,
 * content export) depends on these types. See docs/jam-player-voice-engine.md.
 *
 * Design rules encoded here:
 *  - Velocity selects ARTICULATION, not loudness (MegaVoice). Never scale
 *    velocity to change intensity.
 *  - Notes above FX_PITCH_MIN are FX, not pitches: never transpose, fold, or
 *    velocity-remap them.
 *  - Chart bars hold multiple chords with proportional beat durations.
 */

export type BandPart = "drums" | "bass" | "guitar" | "keys" | "solo"

export type SectionRole =
  | "intro"
  | "verse"
  | "pre_chorus"
  | "chorus"
  | "bridge"
  | "outro"
  | "section"

/**
 * MegaVoice: notes strictly above this are FX/noise, not pitched material.
 *
 * SOURCE OF TRUTH: Yamaha Genos 2 Data List, "MegaVoice Map" table, which
 * states velocity switch points apply "under B5", with "C6 and higher" =
 * strum noise and "C8 and higher" = fret noise.
 *
 * The note-name convention is fixed by the "Drum/SFX Kit List" table in the
 * SAME document, which numbers MIDI 0 = C-1 and MIDI 60 = C4. Therefore:
 *     B5 = 83    C6 = 84    C8 = 108
 *
 * Do not re-derive these from note histograms or from the converted SFZ's
 * key zones. Both were tried and both misled: an inferred "Yamaha C3=60"
 * convention gives C6=96, which is wrong by an octave.
 */
export const FX_PITCH_MIN = 83

/** C6 = 84. Strum noise occupies C6..B7 (84-107). */
export const FX_STRUM_MIN = 84
/** C8 = 108. Fret noise / scratch from here up. */
export const FX_SCRATCH_MIN = 108

export const BEATS_PER_BAR = 4

// ---------------------------------------------------------------------------
// Musical source data
// ---------------------------------------------------------------------------

/** A chord occupying a span of beats, absolute within its section. */
export type ChordEvent = {
  /** Beats from the start of the section. */
  startBeat: number
  durationBeats: number
  /** Pitch class 0-11 (C=0) of the chord root. */
  root: number
  /** Display symbol, e.g. "CM7(9)" or "FM7(9)/A". */
  name: string
  /** Bass pitch class for slash chords; undefined when root position. */
  bassRoot?: number
  /** Roman numeral in the progression's home key, e.g. "IVmaj7". */
  roman?: string
}

export type ProgressionSection = {
  role: SectionRole
  /** Display label, e.g. "Verse (B)". */
  label: string
  bars: number
  chords: ChordEvent[]
}

export type Progression = {
  id: string
  name: string
  /** Home key as pitch class; chords above are expressed in this key. */
  keyPc: number
  keyLabel: string
  tempo?: number
  category?: string
  sections: ProgressionSection[]
  /** Provenance: roman_progression_patterns.id it was derived from. */
  sourcePatternId?: number
}

// ---------------------------------------------------------------------------
// Instruments and articulation
// ---------------------------------------------------------------------------

/**
 * Library-independent articulation vocabulary. Parts request these; a
 * per-library adapter resolves them (MegaVoice: velocity band + FX note range;
 * other libraries: keyswitch or separate region group).
 */
export type Articulation =
  | "sustain"
  | "mute"
  | "dead"
  | "slide"
  | "harmonic"
  | "fx"

/** One SFZ region: the unit the sampler looks up and plays. */
export type SfzRegion = {
  /** Sample path relative to the SFZ file. */
  sample: string
  loKey: number
  hiKey: number
  pitchKeycenter: number
  loVel: number
  hiVel: number
  /** Frame offsets into the sample file. `offset` is mandatory in practice. */
  offset: number
  end: number
  loop: boolean
  /** dB. */
  volume: number
  ampVeltrack: number
  /** Seconds. */
  ampegRelease: number
  ampegSustain: number
  transpose: number
}

export type SfzInstrument = {
  id: string
  label: string
  regions: SfzRegion[]
  /** Base URL the region `sample` paths resolve against. */
  sampleBaseUrl: string
}

// ---------------------------------------------------------------------------
// Style definition (generated from smartbridge.db, not hand-pinned)
// ---------------------------------------------------------------------------

export type StylePartDef = {
  /** Instrument id resolved against the loaded SfzInstrument set. */
  instrument: string
  gain: number
  /** Harmonic parts follow chord roots; drums do not. */
  harmonic: boolean
  /**
   * Genre-aware guitar re-voicing, ported from the desktop
   * GuitarVoicingTransform. Applied AFTER adaptHarmonic, exactly as the
   * desktop applies it after its chord adapter. Omitted means resolve from the
   * style via resolveAutoFromCategory, matching the desktop "Auto" choice.
   */
  voicing?: string
  /** [lo, hi] MIDI range that pitched notes are folded into. */
  register?: [number, number]
  /** Clip id per section role. */
  slots: Partial<Record<SectionRole, number>>
  /** Ranked alternative takes per section role. variations[role][0] === slots[role]. */
  variations?: Partial<Record<SectionRole, number[]>>
  /** Single clip reused for every section. */
  reuseClipId?: number
  fills?: {
    atSectionEnd: boolean
    minSectionBars: number
    pool: number[]
  }
  /**
   * Alternative clips of increasing density, ordered sparse -> busy.
   * Intensity substitutes from here. NEVER implement intensity by scaling
   * velocity: on MegaVoice that changes articulation, not level.
   */
  intensityLadder?: number[]
  /**
   * How this part's clips were matched to the rest of the band, per section.
   * Emitted by export_catalog.py so the pairing is auditable rather than
   * implied — `fallback` means the parts were chosen independently and their
   * musical fit is NOT guaranteed.
   */
  coherence?: Partial<Record<SectionRole, PartCoherence>> | PartCoherence
}

export type CoherenceTier =
  /** Bass and drums came from the same source song. Strongest evidence. */
  | "song_name"
  /** Matched on normalised feel + BPM window + section + time signature. */
  | "feel_bpm"
  /** Chosen by proximity to an already-picked part (guitar). */
  | "proximity"
  /** No pairing available — selected independently. Fit is unverified. */
  | "fallback"

export type PartCoherence = {
  tier: CoherenceTier
  /** BPM window used when tier is "feel_bpm". */
  tolerance?: number | null
  bpmDiff?: number | null
  referenceDrumsClipId?: number
}

export type BandStyle = {
  id: string
  name: string
  category?: string
  tempoDefault: number
  tempoMin: number
  tempoMax: number
  parts: Partial<Record<BandPart, StylePartDef>>
}

// ---------------------------------------------------------------------------
// Note events — the stream both sinks consume
// ---------------------------------------------------------------------------

/**
 * One note, positioned in beats from the start of the arrangement.
 * Consumed identically by the browser sampler and the Web MIDI sink.
 */
export type NoteEvent = {
  /** Beats from arrangement start. Tempo is applied at playback time. */
  beat: number
  /** MIDI note number. Above FX_PITCH_MIN means FX — do not transform. */
  note: number
  /** MIDI velocity. Selects articulation on MegaVoice. */
  velocity: number
  durationBeats: number
}

export type PartEvents = {
  part: BandPart
  events: NoteEvent[]
}

/** A fully realised arrangement, ready to schedule. */
export type Arrangement = {
  styleId: string
  progressionId: string
  keyPc: number
  tempo: number
  totalBars: number
  totalBeats: number
  parts: PartEvents[]
  /** Bar-aligned section spans for chart rendering and section looping. */
  sections: ArrangementSection[]
}

export type ArrangementSection = {
  role: SectionRole
  label: string
  /** 1-indexed, inclusive. */
  startBar: number
  endBar: number
  bars: ChartBar[]
}

// ---------------------------------------------------------------------------
// Chart model — what the practice screen renders
// ---------------------------------------------------------------------------

/**
 * A bar holds one or more chords whose `beats` sum to BEATS_PER_BAR.
 * The chart renders cell widths proportional to `beats`.
 */
export type ChartChord = {
  /** Display symbol in the current key, e.g. "GM7(9)". */
  symbol: string
  /** Beats this chord occupies within its bar. */
  beats: number
  root: number
  bassRoot?: number
}

export type ChartBar = {
  /** 1-indexed within the whole arrangement. */
  barNumber: number
  chords: ChartChord[]
}

/** Inclusive 1-indexed bar range. */
export type LoopRange = {
  startBar: number
  endBar: number
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

export type TransportStatus = "idle" | "loading" | "ready" | "playing"

export type PartMixState = {
  /** 0-1. Independent of velocity — see the articulation rule above. */
  volume: number
  muted: boolean
}

export type PracticeState = {
  /** The part the user plays; muted automatically. */
  userPart: BandPart | null
  tempo: number
  /** Ramp-trainer target; null when not training. */
  targetTempo: number | null
  keyPc: number
  loop: LoopRange | null
  countIn: boolean
  metronome: boolean
  mix: Record<BandPart, PartMixState>
}
