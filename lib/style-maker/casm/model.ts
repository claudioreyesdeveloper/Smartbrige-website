/**
 * StyleCasmModel — TypeScript port of SmartBridge/Source/StyleMaker/StyleCasmModel.h/.cpp
 *
 * Field layout follows the JosoSoft "Yamaha Keyboards - Programming" reference:
 *   - CASM Section Format 1 (SFF1 / pre-Tyros-3)
 *   - CASM Section Format 2 (SFF2 / Tyros-3 and later)
 *
 * Ported verbatim from desktop; do not invent alternate encodings.
 */

export enum CasmFormat {
  Unknown = "Unknown",
  Format1 = "Format1",
  Format2 = "Format2",
}

/** Note Transposition Rule (CASM line 22 / Ctb2 line 24). */
export enum Ntr {
  RootTrans = "RootTrans",
  RootFixed = "RootFixed",
  Guitar = "Guitar",
  Unknown = "Unknown",
}

/**
 * Note Transposition Table (CASM line 23/32 and Ctb2 line 25).
 * Low 7 bits select the table; bit 7 (0x80) is the "bass on" flag in Format 2.
 */
export enum Ntt {
  Bypass = "Bypass",
  Melody = "Melody",
  Chord = "Chord",
  Bass = "Bass",
  MelodicMinor = "MelodicMinor",
  MelodicMinor5th = "MelodicMinor5th",
  HarmonicMinor = "HarmonicMinor",
  HarmonicMinor5th = "HarmonicMinor5th",
  NaturalMinor = "NaturalMinor",
  NaturalMinor5th = "NaturalMinor5th",
  Dorian = "Dorian",
  Dorian5th = "Dorian5th",
  GuitarAllPurpose = "GuitarAllPurpose",
  GuitarStroke = "GuitarStroke",
  GuitarArpeggio = "GuitarArpeggio",
  Unknown = "Unknown",
}

/** Retrigger Rule (CASM line 27 / Ctb2 line 29). */
export enum RetriggerRule {
  Stop = "Stop",
  PitchShift = "PitchShift",
  PitchShiftToRoot = "PitchShiftToRoot",
  Retrigger = "Retrigger",
  RetriggerToRoot = "RetriggerToRoot",
  NoteGenerator = "NoteGenerator",
  Unknown = "Unknown",
}

export type CasmNoteZone = {
  ntr: Ntr
  ntt: Ntt
  bassOn: boolean
  highKey: number
  noteLowLimit: number
  noteHighLimit: number
  retrigger: RetriggerRule
  rawNtr: number
  rawNtt: number
  rawHighKey: number
  rawNoteLow: number
  rawNoteHigh: number
  rawRetrigger: number
}

export type CtabEntry = {
  isCtb2: boolean
  sourceChannel: number
  destinationPart: number
  destinationChannel: number
  voiceName: string
  editable: boolean
  noteMute: [number, number]
  chordMute: [number, number, number, number, number]
  sourceRoot: number
  sourceChordType: number
  sourceChordIsMinor: boolean
  sourceChordIsSeventh: boolean
  zone: CasmNoteZone
  zones: CasmNoteZone[]
  lowMiddleLimit: number
  middleHighLimit: number
  extraBreakVoice: boolean
  alwaysDrumChannel: boolean
  drumInstrument: number
  drumVolume: number
  rawBytes: Uint8Array
  warnings: string[]
}

export type SdecPart = {
  partNames: string[]
  rawBytes: Uint8Array
}

export type CsegGroup = {
  rawOffset: number
  rawLength: number
  sdec: SdecPart
  ctabEntries: CtabEntry[]
  rawBytes: Uint8Array
  warnings: string[]
}

export type StyleCasmModel = {
  format: CasmFormat
  valid: boolean
  rawCasmBytes: Uint8Array
  csegGroups: CsegGroup[]
  warnings: string[]
}

export function decodeNtr(raw: number): Ntr {
  switch (raw) {
    case 0x00:
      return Ntr.RootTrans
    case 0x01:
      return Ntr.RootFixed
    case 0x02:
      return Ntr.Guitar
    default:
      return Ntr.Unknown
  }
}

export function decodeNtt(raw: number, ntr: Ntr): Ntt {
  const table = raw & 0x7f
  if (ntr === Ntr.Guitar) {
    switch (table) {
      case 0x00:
        return Ntt.GuitarAllPurpose
      case 0x01:
        return Ntt.GuitarStroke
      case 0x02:
        return Ntt.GuitarArpeggio
      default:
        return Ntt.Unknown
    }
  }
  switch (table) {
    case 0:
      return Ntt.Bypass
    case 1:
      return Ntt.Melody
    case 2:
      return Ntt.Chord
    case 3:
      return Ntt.Bass
    case 4:
      return Ntt.MelodicMinor
    case 5:
      return Ntt.MelodicMinor5th
    case 6:
      return Ntt.HarmonicMinor
    case 7:
      return Ntt.HarmonicMinor5th
    case 8:
      return Ntt.NaturalMinor
    case 9:
      return Ntt.NaturalMinor5th
    case 10:
      return Ntt.Dorian
    case 11:
      return Ntt.Dorian5th
    default:
      return Ntt.Unknown
  }
}

export function decodeRetrigger(raw: number): RetriggerRule {
  switch (raw) {
    case 0x00:
      return RetriggerRule.Stop
    case 0x01:
      return RetriggerRule.PitchShift
    case 0x02:
      return RetriggerRule.PitchShiftToRoot
    case 0x03:
      return RetriggerRule.Retrigger
    case 0x04:
      return RetriggerRule.RetriggerToRoot
    case 0x05:
      return RetriggerRule.NoteGenerator
    default:
      return RetriggerRule.Unknown
  }
}

export function encodeNtr(v: Ntr): number {
  switch (v) {
    case Ntr.RootTrans:
      return 0x00
    case Ntr.RootFixed:
      return 0x01
    case Ntr.Guitar:
      return 0x02
    case Ntr.Unknown:
      return -1
  }
}

export function nttIsGuitarTable(v: Ntt): boolean {
  return v === Ntt.GuitarAllPurpose || v === Ntt.GuitarStroke || v === Ntt.GuitarArpeggio
}

export function encodeNtt(v: Ntt): number {
  switch (v) {
    case Ntt.Bypass:
      return 0
    case Ntt.Melody:
      return 1
    case Ntt.Chord:
      return 2
    case Ntt.Bass:
      return 3
    case Ntt.MelodicMinor:
      return 4
    case Ntt.MelodicMinor5th:
      return 5
    case Ntt.HarmonicMinor:
      return 6
    case Ntt.HarmonicMinor5th:
      return 7
    case Ntt.NaturalMinor:
      return 8
    case Ntt.NaturalMinor5th:
      return 9
    case Ntt.Dorian:
      return 10
    case Ntt.Dorian5th:
      return 11
    case Ntt.GuitarAllPurpose:
      return 0x00
    case Ntt.GuitarStroke:
      return 0x01
    case Ntt.GuitarArpeggio:
      return 0x02
    case Ntt.Unknown:
      return -1
  }
}

export function encodeRetrigger(v: RetriggerRule): number {
  switch (v) {
    case RetriggerRule.Stop:
      return 0x00
    case RetriggerRule.PitchShift:
      return 0x01
    case RetriggerRule.PitchShiftToRoot:
      return 0x02
    case RetriggerRule.Retrigger:
      return 0x03
    case RetriggerRule.RetriggerToRoot:
      return 0x04
    case RetriggerRule.NoteGenerator:
      return 0x05
    case RetriggerRule.Unknown:
      return -1
  }
}

const kChordTypes = [
  "Maj",
  "Maj6",
  "Maj7",
  "M7#11",
  "Madd9",
  "M7(9)",
  "M6(9)",
  "aug",
  "m",
  "m6",
  "m7",
  "m7b5",
  "m(9)",
  "m7(9)",
  "m7(11)",
  "mM7",
  "mM7(9)",
  "dim",
  "dim7",
  "7",
  "7sus",
  "7b5",
  "7(9)",
  "7(#11)",
  "7(13)",
  "7(b9)",
  "7(b13)",
  "7(#9)",
  "M7aug",
  "7aug",
  "1+8",
  "1+5",
  "sus4",
  "1+2+5",
]

export function chordTypeName(type: number): string {
  if (type >= 0 && type < kChordTypes.length) return kChordTypes[type]
  return "?"
}

export function chordTypeIsMinor(type: number): boolean {
  if (type < 0 || type >= kChordTypes.length) return false
  const name = kChordTypes[type]
  return name.startsWith("m") || name.startsWith("dim")
}

export function chordTypeIsSeventh(type: number): boolean {
  if (type < 0 || type >= kChordTypes.length) return false
  return kChordTypes[type].includes("7")
}

export function emptyNoteZone(): CasmNoteZone {
  return {
    ntr: Ntr.Unknown,
    ntt: Ntt.Unknown,
    bassOn: false,
    highKey: 0,
    noteLowLimit: 0,
    noteHighLimit: 127,
    retrigger: RetriggerRule.Unknown,
    rawNtr: 0,
    rawNtt: 0,
    rawHighKey: 0,
    rawNoteLow: 0,
    rawNoteHigh: 0,
    rawRetrigger: 0,
  }
}
