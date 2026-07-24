/**
 * StyleCasmWriter — port of SmartBridge/Source/StyleMaker/StyleCasmWriter.cpp
 *
 * Layer B/C: size-preserving Ctab/Ctb2 field patching.
 * Layer D: appendDuplicateRecord / appendCsegFromTemplate with length rebuild.
 */

import {
  decodeNtr,
  encodeNtr,
  encodeNtt,
  encodeRetrigger,
  Ntr,
  type Ntt,
  nttIsGuitarTable,
  type RetriggerRule,
} from "./model"
import { findTag, readU32be, splitSdecNames } from "./parser"

const kCtb2PayloadLen = 47

export type CtabFieldPatch = {
  sourceRoot?: number
  sourceChordType?: number
  chordMute?: [number, number, number, number, number]
  ntr?: Ntr
  ntt?: Ntt
  highKey?: number
  noteLowLimit?: number
  noteHighLimit?: number
  retrigger?: RetriggerRule
  bassOn?: boolean
  newSourceChannel?: number
  newDestinationCh?: number
  voiceName?: string
  openNoteMask?: boolean
}

export type CtabPatchResult = {
  ok: boolean
  recordsPatched: number
  data: Uint8Array
  notes: string[]
}

export type CasmStructEditResult = {
  ok: boolean
  data: Uint8Array
  notes: string[]
  recordsAdded: number
  csegsAdded: number
}

function isEmptyPatch(patch: CtabFieldPatch): boolean {
  return !(
    patch.sourceRoot !== undefined ||
    patch.sourceChordType !== undefined ||
    patch.chordMute ||
    patch.ntr !== undefined ||
    patch.ntt !== undefined ||
    patch.highKey !== undefined ||
    patch.noteLowLimit !== undefined ||
    patch.noteHighLimit !== undefined ||
    patch.retrigger !== undefined ||
    patch.bassOn !== undefined ||
    patch.newSourceChannel !== undefined ||
    patch.newDestinationCh !== undefined ||
    patch.voiceName !== undefined ||
    patch.openNoteMask
  )
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value))
}

function writeU32be(data: Uint8Array, offset: number, value: number) {
  data[offset] = (value >>> 24) & 0xff
  data[offset + 1] = (value >>> 16) & 0xff
  data[offset + 2] = (value >>> 8) & 0xff
  data[offset + 3] = value & 0xff
}

function patchZone(body: Uint8Array, offset: number, patch: CtabFieldPatch, notes: string[]) {
  const existingNtr = decodeNtr(body[offset])
  const targetNtr = patch.ntr !== undefined ? patch.ntr : existingNtr

  if (patch.ntr !== undefined) {
    const raw = encodeNtr(patch.ntr)
    if (raw >= 0) body[offset] = raw
    else notes.push("NTR value not encodable; left unchanged")
  }

  if (patch.ntt !== undefined) {
    const table = encodeNtt(patch.ntt)
    if (table < 0) {
      notes.push("NTT value not encodable; left unchanged")
    } else if (nttIsGuitarTable(patch.ntt) && targetNtr !== Ntr.Guitar) {
      notes.push(
        "Guitar NTT requested without NTR=Guitar; skipped to avoid invalid CASM",
      )
    } else {
      const bassBit =
        patch.bassOn !== undefined
          ? patch.bassOn
            ? 0x80
            : 0x00
          : body[offset + 1] & 0x80
      body[offset + 1] = (table & 0x7f) | bassBit
    }
  } else if (patch.bassOn !== undefined) {
    body[offset + 1] =
      (body[offset + 1] & 0x7f) | (patch.bassOn ? 0x80 : 0x00)
  }

  if (patch.highKey !== undefined) {
    body[offset + 2] = clamp(patch.highKey, 0, 127)
  }
  if (patch.noteLowLimit !== undefined) {
    body[offset + 3] = clamp(patch.noteLowLimit, 0, 127)
  }
  if (patch.noteHighLimit !== undefined) {
    body[offset + 4] = clamp(patch.noteHighLimit, 0, 127)
  }
  if (patch.retrigger !== undefined) {
    const raw = encodeRetrigger(patch.retrigger)
    if (raw >= 0) body[offset + 5] = raw
    else notes.push("retrigger value not encodable; left unchanged")
  }
}

function patchRecordBody(
  body: Uint8Array,
  isCtb2: boolean,
  patch: CtabFieldPatch,
  notes: string[],
) {
  if (body.length < 20) {
    notes.push("record body too short to patch")
    return
  }

  if (patch.newSourceChannel !== undefined) {
    const ch = clamp(patch.newSourceChannel, 1, 16)
    body[0] = ch - 1
  }
  if (patch.newDestinationCh !== undefined) {
    const ch = patch.newDestinationCh
    if (ch >= 9 && ch <= 16) body[9] = 0x08 + (ch - 9)
    else {
      notes.push(
        `destination channel ${ch} out of style range 9..16; left unchanged`,
      )
    }
  }
  if (patch.voiceName !== undefined) {
    const ascii = patch.voiceName.slice(0, 8)
    for (let i = 0; i < 8; i += 1) body[1 + i] = 0x20
    for (let i = 0; i < ascii.length; i += 1) {
      body[1 + i] = ascii.charCodeAt(i) & 0x7f
    }
  }
  if (patch.openNoteMask) {
    body[11] = 0x0f
    body[12] = 0xff
  }
  if (patch.sourceRoot !== undefined) {
    body[18] = clamp(patch.sourceRoot, 0, 11)
  }
  if (patch.sourceChordType !== undefined) {
    body[19] = clamp(patch.sourceChordType, 0, 0x21)
  }
  if (patch.chordMute) {
    for (let i = 0; i < 5; i += 1) body[13 + i] = patch.chordMute[i]
  }

  if (isCtb2) {
    if (body.length >= kCtb2PayloadLen) {
      patchZone(body, 22, patch, notes)
      patchZone(body, 28, patch, notes)
      patchZone(body, 34, patch, notes)
    } else {
      notes.push("Ctb2 body shorter than expected; zone fields skipped")
    }
  } else if (body.length >= 26) {
    patchZone(body, 20, patch, notes)
  } else {
    notes.push("Ctab body shorter than a full SFF1 record; zone fields skipped")
  }
}

function sectionMatches(
  raw: Uint8Array,
  csegPos: number,
  csegEnd: number,
  sectionName: string,
): boolean {
  if (!sectionName.trim()) return true
  const sdecRel = findTag(raw, "Sdec", csegPos + 8)
  if (sdecRel < 0 || sdecRel >= csegEnd) return false
  const sdecLen = readU32be(raw, sdecRel + 4)
  if (sdecRel + 8 + sdecLen > csegEnd) return false
  const names = splitSdecNames(raw.subarray(sdecRel + 8, sdecRel + 8 + sdecLen))
  const wanted = sectionName.trim().toLowerCase()
  return names.some((name) => name.toLowerCase() === wanted)
}

/** Patch every Ctab/Ctb2 whose source channel (1-based) matches. */
export function patchCtab(
  casm: Uint8Array,
  sourceChannel1Based: number,
  patch: CtabFieldPatch,
  sectionName = "",
): CtabPatchResult {
  const result: CtabPatchResult = {
    ok: false,
    recordsPatched: 0,
    data: casm.slice(),
    notes: [],
  }

  if (isEmptyPatch(patch)) {
    result.ok = true
    result.notes.push("no fields requested; nothing to patch")
    return result
  }

  const base = result.data
  if (base.length < 8) {
    result.notes.push("buffer too small to contain a CASM section")
    return result
  }

  const casmPos = findTag(base, "CASM", 0)
  if (casmPos < 0) {
    result.notes.push("no CASM marker found")
    return result
  }

  const raw = base.subarray(casmPos)
  const casmLen = readU32be(raw, 4)
  const casmEnd = Math.min(raw.length, 8 + casmLen)
  const sectionFilter = sectionName.trim().length > 0
  let pos = 8

  while (pos + 8 <= casmEnd) {
    const csegRel = findTag(raw, "CSEG", pos)
    if (csegRel < 0) break
    const csegPos = csegRel
    const csegLen = readU32be(raw, csegPos + 4)
    const csegEnd = Math.min(casmEnd, csegPos + 8 + csegLen)
    const matches = sectionMatches(raw, csegPos, csegEnd, sectionName)

    if (matches) {
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
          p += 4
          continue
        }
        const body = raw.subarray(p + 8, p + 8 + ctbLen)
        const recordSrcCh = body[0] + 1
        if (recordSrcCh === sourceChannel1Based) {
          patchRecordBody(body, isCtb2, patch, result.notes)
          result.recordsPatched += 1
        }
        p += 8 + ctbLen
      }
    }
    pos = csegEnd
  }

  result.ok = true
  if (result.recordsPatched === 0) {
    result.notes.push(
      `no Ctab/Ctb2 matched source channel ${sourceChannel1Based}` +
        (sectionFilter ? ` in section '${sectionName}'` : ""),
    )
  } else {
    result.notes.push(
      `patched ${result.recordsPatched} record(s); byte size preserved, chunk lengths intact`,
    )
  }
  return result
}

function appendChunk(out: number[], tag: string, payload: Uint8Array) {
  for (let i = 0; i < 4; i += 1) out.push(tag.charCodeAt(i))
  out.push((payload.length >>> 24) & 0xff)
  out.push((payload.length >>> 16) & 0xff)
  out.push((payload.length >>> 8) & 0xff)
  out.push(payload.length & 0xff)
  for (let i = 0; i < payload.length; i += 1) out.push(payload[i])
}

type RecordLoc = {
  found: boolean
  csegPos: number
  csegEnd: number
  bodyOff: number
  bodyLen: number
  isCtb2: boolean
}

function locateRecord(
  raw: Uint8Array,
  casmEnd: number,
  srcCh: number,
  sectionName: string,
): RecordLoc {
  const loc: RecordLoc = {
    found: false,
    csegPos: 0,
    csegEnd: 0,
    bodyOff: 0,
    bodyLen: 0,
    isCtb2: false,
  }
  let pos = 8
  while (pos + 8 <= casmEnd) {
    const csegRel = findTag(raw, "CSEG", pos)
    if (csegRel < 0) break
    const csegPos = csegRel
    const csegLen = readU32be(raw, csegPos + 4)
    const csegEnd = Math.min(casmEnd, csegPos + 8 + csegLen)
    if (sectionMatches(raw, csegPos, csegEnd, sectionName)) {
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
          p += 4
          continue
        }
        if (raw[p + 8] + 1 === srcCh) {
          loc.found = true
          loc.csegPos = csegPos
          loc.csegEnd = csegEnd
          loc.bodyOff = p + 8
          loc.bodyLen = ctbLen
          loc.isCtb2 = isCtb2
          return loc
        }
        p += 8 + ctbLen
      }
    }
    pos = csegEnd
  }
  return loc
}

/** Duplicate first matching Ctab/Ctb2 and append to the same CSEG with overrides. */
export function appendDuplicateRecord(
  casm: Uint8Array,
  sourceChannel1Based: number,
  overrides: CtabFieldPatch,
  sectionName = "",
): CasmStructEditResult {
  const result: CasmStructEditResult = {
    ok: false,
    data: casm.slice(),
    notes: [],
    recordsAdded: 0,
    csegsAdded: 0,
  }

  if (result.data.length < 8) {
    result.notes.push("buffer too small")
    return result
  }

  const casmPos = findTag(result.data, "CASM", 0)
  if (casmPos < 0) {
    result.notes.push("no CASM marker")
    return result
  }

  const raw = result.data.subarray(casmPos)
  const casmLen = readU32be(raw, 4)
  const casmEnd = Math.min(result.data.length - casmPos, 8 + casmLen)
  const loc = locateRecord(raw, casmEnd, sourceChannel1Based, sectionName)
  if (!loc.found) {
    result.notes.push(`no record matched source channel ${sourceChannel1Based}`)
    result.ok = true
    return result
  }

  const body = raw.subarray(loc.bodyOff, loc.bodyOff + loc.bodyLen).slice()
  patchRecordBody(body, loc.isCtb2, overrides, result.notes)

  const chunk: number[] = []
  appendChunk(chunk, loc.isCtb2 ? "Ctb2" : "Ctab", body)

  const insertAt = casmPos + loc.csegEnd
  const out = new Uint8Array(result.data.length + chunk.length)
  out.set(result.data.subarray(0, insertAt), 0)
  out.set(Uint8Array.from(chunk), insertAt)
  out.set(result.data.subarray(insertAt), insertAt + chunk.length)
  result.data = out

  const newRaw = result.data.subarray(casmPos)
  writeU32be(
    newRaw,
    loc.csegPos + 4,
    readU32be(newRaw, loc.csegPos + 4) + chunk.length,
  )
  writeU32be(newRaw, 4, readU32be(newRaw, 4) + chunk.length)

  result.recordsAdded = 1
  result.ok = true
  result.notes.push(
    `appended ${chunk.length} bytes; CSEG + CASM lengths rebuilt`,
  )
  return result
}

export function appendCsegFromTemplate(
  casm: Uint8Array,
  sdecParts: string[],
  templateSourceChannel: number,
  overrides: CtabFieldPatch,
): CasmStructEditResult {
  const result: CasmStructEditResult = {
    ok: false,
    data: casm.slice(),
    notes: [],
    recordsAdded: 0,
    csegsAdded: 0,
  }

  if (result.data.length < 8) {
    result.notes.push("buffer too small")
    return result
  }

  const casmPos = findTag(result.data, "CASM", 0)
  if (casmPos < 0) {
    result.notes.push("no CASM marker")
    return result
  }

  const raw = result.data.subarray(casmPos)
  const casmLen = readU32be(raw, 4)
  const casmEnd = Math.min(result.data.length - casmPos, 8 + casmLen)
  const loc = locateRecord(raw, casmEnd, templateSourceChannel, "")
  if (!loc.found) {
    result.notes.push(
      `no template record for source channel ${templateSourceChannel}`,
    )
    result.ok = true
    return result
  }

  const body = raw.subarray(loc.bodyOff, loc.bodyOff + loc.bodyLen).slice()
  patchRecordBody(body, loc.isCtb2, overrides, result.notes)

  const partsCsv = sdecParts.join(",")
  const sdecPayload = Uint8Array.from(
    Array.from(partsCsv).map((ch) => ch.charCodeAt(0) & 0x7f),
  )
  const csegPayload: number[] = []
  appendChunk(csegPayload, "Sdec", sdecPayload)
  appendChunk(csegPayload, loc.isCtb2 ? "Ctb2" : "Ctab", body)

  const cseg: number[] = []
  appendChunk(cseg, "CSEG", Uint8Array.from(csegPayload))

  const insertAt = casmPos + casmEnd
  const out = new Uint8Array(result.data.length + cseg.length)
  out.set(result.data.subarray(0, insertAt), 0)
  out.set(Uint8Array.from(cseg), insertAt)
  out.set(result.data.subarray(insertAt), insertAt + cseg.length)
  result.data = out

  const newRaw = result.data.subarray(casmPos)
  writeU32be(newRaw, 4, readU32be(newRaw, 4) + cseg.length)

  result.csegsAdded = 1
  result.recordsAdded = 1
  result.ok = true
  result.notes.push(
    `appended CSEG (${cseg.length} bytes) with Sdec '${partsCsv}'; CASM length rebuilt`,
  )
  return result
}

export { patchRecordBody }
