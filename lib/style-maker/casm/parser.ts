/**
 * StyleCasmParser — port of SmartBridge/Source/StyleMaker/StyleCasmParser.cpp
 * Byte-accurate CASM parser. Field offsets follow programming.pdf Format 1 / 2.
 */

import {
  CasmFormat,
  type CasmNoteZone,
  type CsegGroup,
  type CtabEntry,
  chordTypeIsMinor,
  chordTypeIsSeventh,
  decodeNtr,
  decodeNtt,
  decodeRetrigger,
  emptyNoteZone,
  Ntr,
  Ntt,
  RetriggerRule,
  type StyleCasmModel,
} from "./model"

const kCtb2PayloadLen = 47

function findTag(data: Uint8Array, tag: string, from = 0): number {
  const a = tag.charCodeAt(0)
  const b = tag.charCodeAt(1)
  const c = tag.charCodeAt(2)
  const d = tag.charCodeAt(3)
  for (let i = from; i + 4 <= data.length; i += 1) {
    if (data[i] === a && data[i + 1] === b && data[i + 2] === c && data[i + 3] === d) {
      return i
    }
  }
  return -1
}

function readU32be(data: Uint8Array, offset: number): number {
  return (
    ((data[offset] << 24) >>> 0) +
    ((data[offset + 1] << 16) >>> 0) +
    ((data[offset + 2] << 8) >>> 0) +
    (data[offset + 3] >>> 0)
  )
}

function readVoiceName(body: Uint8Array): string {
  let out = ""
  for (let i = 1; i <= 8; i += 1) {
    const ch = body[i]
    if (ch >= 32 && ch <= 126) out += String.fromCharCode(ch)
  }
  return out.trim()
}

function readZone(body: Uint8Array, offset: number, forcedNtrContext: Ntr): CasmNoteZone {
  const z = emptyNoteZone()
  z.rawNtr = body[offset]
  z.rawNtt = body[offset + 1]
  z.rawHighKey = body[offset + 2]
  z.rawNoteLow = body[offset + 3]
  z.rawNoteHigh = body[offset + 4]
  z.rawRetrigger = body[offset + 5]

  z.ntr = decodeNtr(z.rawNtr)
  z.bassOn = (z.rawNtt & 0x80) !== 0
  const ntrForNtt = z.ntr === Ntr.Guitar ? Ntr.Guitar : forcedNtrContext
  z.ntt = decodeNtt(z.rawNtt, ntrForNtt === Ntr.Guitar ? Ntr.Guitar : z.ntr)
  z.highKey = z.rawHighKey
  z.noteLowLimit = z.rawNoteLow
  z.noteHighLimit = z.rawNoteHigh
  z.retrigger = decodeRetrigger(z.rawRetrigger)
  return z
}

function noteZoneWarnings(z: CasmNoteZone, warnings: string[], label: string) {
  if (z.ntr === Ntr.Unknown) {
    warnings.push(`${label} NTR unknown (raw 0x${z.rawNtr.toString(16)})`)
  }
  if (z.ntt === Ntt.Unknown) {
    warnings.push(`${label} NTT unknown (raw 0x${z.rawNtt.toString(16)})`)
  }
  if (z.retrigger === RetriggerRule.Unknown) {
    warnings.push(`${label} retrigger unknown (raw 0x${z.rawRetrigger.toString(16)})`)
  }
}

function parseCtab(body: Uint8Array, isCtb2: boolean): CtabEntry {
  const c: CtabEntry = {
    isCtb2,
    sourceChannel: 0,
    destinationPart: 0,
    destinationChannel: 0,
    voiceName: "",
    editable: true,
    noteMute: [0, 0],
    chordMute: [0, 0, 0, 0, 0],
    sourceRoot: 0,
    sourceChordType: 0,
    sourceChordIsMinor: false,
    sourceChordIsSeventh: false,
    zone: emptyNoteZone(),
    zones: [],
    lowMiddleLimit: 0,
    middleHighLimit: 127,
    extraBreakVoice: false,
    alwaysDrumChannel: false,
    drumInstrument: -1,
    drumVolume: -1,
    rawBytes: body.slice(),
    warnings: [],
  }

  const len = body.length
  if (len >= 20) {
    c.sourceChannel = body[0] + 1
    c.voiceName = readVoiceName(body)
    c.destinationPart = body[9]
    c.destinationChannel =
      body[9] >= 0x08 && body[9] <= 0x0f ? body[9] - 0x08 + 9 : 0
    c.editable = body[10] === 0x00
    c.noteMute = [body[11], body[12]]
    c.chordMute = [body[13], body[14], body[15], body[16], body[17]]
    c.sourceRoot = body[18]
    c.sourceChordType = body[19]
    c.sourceChordIsMinor = chordTypeIsMinor(body[19])
    c.sourceChordIsSeventh = chordTypeIsSeventh(body[19])
  } else {
    c.warnings.push(`Ctab body too short (${len} bytes)`)
    return c
  }

  if (c.destinationChannel === 0) {
    c.warnings.push(
      `destination part 0x${body[9].toString(16)} is not a style part (0x08-0x0F)`,
    )
  }

  if (isCtb2) {
    if (len >= kCtb2PayloadLen) {
      c.lowMiddleLimit = body[20]
      c.middleHighLimit = body[21]
      const low = readZone(body, 22, Ntr.Unknown)
      const mid = readZone(body, 28, Ntr.Unknown)
      const high = readZone(body, 34, Ntr.Unknown)
      c.zones = [low, mid, high]
      c.zone = mid
      noteZoneWarnings(low, c.warnings, "low zone")
      noteZoneWarnings(mid, c.warnings, "middle zone")
      noteZoneWarnings(high, c.warnings, "high zone")
      c.extraBreakVoice = body[40] === 0x80
      c.alwaysDrumChannel = body[41] === 0x01 || body[43] === 0x18
      if (c.alwaysDrumChannel) {
        c.drumInstrument = body[44]
        c.drumVolume = body[45]
      }
    } else {
      c.warnings.push(
        `Ctb2 payload shorter than expected (${len} < ${kCtb2PayloadLen})`,
      )
    }
  } else if (len >= 26) {
    c.zone = readZone(body, 20, Ntr.Unknown)
    c.zones = [c.zone]
    noteZoneWarnings(c.zone, c.warnings, "zone")
  } else {
    c.warnings.push("Ctab payload shorter than a full SFF1 record")
  }

  return c
}

function splitSdecNames(payload: Uint8Array): string[] {
  let s = ""
  for (let i = 0; i < payload.length; i += 1) {
    if (payload[i] >= 32 && payload[i] <= 126) s += String.fromCharCode(payload[i])
  }
  return s
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Parse CASM from a full style file buffer or a yamahaTail that starts at CASM. */
export function parseCasm(data: Uint8Array): StyleCasmModel {
  const model: StyleCasmModel = {
    format: CasmFormat.Unknown,
    valid: false,
    rawCasmBytes: new Uint8Array(),
    csegGroups: [],
    warnings: [],
  }

  if (data.length < 8) {
    model.warnings.push("buffer too small to contain a CASM section")
    return model
  }

  const casmPos = findTag(data, "CASM")
  if (casmPos < 0) {
    model.warnings.push("no CASM marker found")
    return model
  }

  const raw = data.subarray(casmPos)
  const casmLen = readU32be(raw, 4)
  let casmEnd = 8 + casmLen
  if (casmEnd > raw.length) {
    model.warnings.push(
      `CASM length (${casmLen}) exceeds available bytes; clamping`,
    )
    casmEnd = raw.length
  }
  model.rawCasmBytes = raw.subarray(0, casmEnd)
  model.valid = true

  let anyCtb2 = false
  let anyCtab = false
  let pos = 8

  while (pos + 8 <= casmEnd) {
    const csegRel = findTag(raw, "CSEG", pos)
    if (csegRel < 0) break

    const csegPos = csegRel
    const csegLen = readU32be(raw, csegPos + 4)
    let csegEnd = csegPos + 8 + csegLen
    if (csegEnd > casmEnd) {
      model.warnings.push(`CSEG at offset ${csegPos} overruns CASM; clamping`)
      csegEnd = casmEnd
    }

    const group: CsegGroup = {
      rawOffset: csegPos,
      rawLength: csegLen,
      sdec: { partNames: [], rawBytes: new Uint8Array() },
      ctabEntries: [],
      rawBytes: raw.subarray(csegPos, csegEnd),
      warnings: [],
    }

    const sdecRel = findTag(raw, "Sdec", csegPos + 8)
    if (sdecRel >= 0 && sdecRel < csegEnd) {
      const sdecPos = sdecRel
      const sdecLen = readU32be(raw, sdecPos + 4)
      if (sdecPos + 8 + sdecLen <= csegEnd) {
        const payload = raw.subarray(sdecPos + 8, sdecPos + 8 + sdecLen)
        group.sdec.partNames = splitSdecNames(payload)
        group.sdec.rawBytes = payload.slice()
      } else {
        group.warnings.push("Sdec length overruns CSEG")
      }
    } else {
      group.warnings.push("no Sdec block in CSEG")
    }

    let p = csegPos + 8
    while (p + 8 <= csegEnd) {
      const isCtab =
        raw[p] === 0x43 &&
        raw[p + 1] === 0x74 &&
        raw[p + 2] === 0x61 &&
        raw[p + 3] === 0x62
      const isCtb2 =
        raw[p] === 0x43 &&
        raw[p + 1] === 0x74 &&
        raw[p + 2] === 0x62 &&
        raw[p + 3] === 0x32
      if (!isCtab && !isCtb2) {
        p += 1
        continue
      }

      const ctbLen = readU32be(raw, p + 4)
      if (ctbLen < 10 || p + 8 + ctbLen > csegEnd) {
        group.warnings.push(
          `${isCtb2 ? "Ctb2" : "Ctab"} length invalid at offset ${p}`,
        )
        p += 4
        continue
      }

      anyCtb2 = anyCtb2 || isCtb2
      anyCtab = anyCtab || isCtab
      group.ctabEntries.push(parseCtab(raw.subarray(p + 8, p + 8 + ctbLen), isCtb2))
      p += 8 + ctbLen
    }

    model.csegGroups.push(group)
    pos = csegEnd
  }

  if (anyCtb2) model.format = CasmFormat.Format2
  else if (anyCtab) model.format = CasmFormat.Format1
  else model.warnings.push("CASM contained no Ctab/Ctb2 records")

  return model
}

export { findTag, readU32be, splitSdecNames }
