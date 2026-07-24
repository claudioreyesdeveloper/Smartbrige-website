import { describe, expect, it } from "vitest"
import {
  encodeNtr,
  encodeNtt,
  Ntr,
  Ntt,
  parseCasm,
  patchCtab,
  RetriggerRule,
  styleChannel,
  StyleMakerLane,
} from "@/lib/style-maker"

function writeU32be(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]
}

/** Minimal CASM: one CSEG for Main A with one Bass Ctab (Format 1). */
function buildMinimalCasm(): Uint8Array {
  // Ctab body (26 bytes minimum for SFF1 zone)
  const body = new Uint8Array(26)
  body[0] = 10 // source channel 11 (0-based 10)
  for (let i = 1; i <= 8; i += 1) body[i] = "Bass    ".charCodeAt(i - 1)
  body[9] = 0x0a // Bass destination part
  body[10] = 0x00
  body[11] = 0x0f
  body[12] = 0xff
  body[18] = 0 // C
  body[19] = 2 // Maj7
  body[20] = 0x00 // RootTrans
  body[21] = 0x01 | 0x80 // Melody + bass on
  body[22] = 127
  body[23] = 28
  body[24] = 55
  body[25] = 0x02 // PitchShiftToRoot

  const sdecPayload = Array.from("Main A").map((c) => c.charCodeAt(0))
  const ctabChunk = [
    ..."Ctab".split("").map((c) => c.charCodeAt(0)),
    ...writeU32be(body.length),
    ...body,
  ]
  const sdecChunk = [
    ..."Sdec".split("").map((c) => c.charCodeAt(0)),
    ...writeU32be(sdecPayload.length),
    ...sdecPayload,
  ]
  const csegPayload = [...sdecChunk, ...ctabChunk]
  const csegChunk = [
    ..."CSEG".split("").map((c) => c.charCodeAt(0)),
    ...writeU32be(csegPayload.length),
    ...csegPayload,
  ]
  const casmPayload = csegChunk
  return Uint8Array.from([
    ..."CASM".split("").map((c) => c.charCodeAt(0)),
    ...writeU32be(casmPayload.length),
    ...casmPayload,
  ])
}

describe("CASM model (desktop port)", () => {
  it("encodes NTR/NTT the same as StyleCasmModel.cpp", () => {
    expect(encodeNtr(Ntr.RootTrans)).toBe(0x00)
    expect(encodeNtr(Ntr.RootFixed)).toBe(0x01)
    expect(encodeNtr(Ntr.Guitar)).toBe(0x02)
    expect(encodeNtt(Ntt.Bypass)).toBe(0)
    expect(encodeNtt(Ntt.Melody)).toBe(1)
    expect(encodeNtt(Ntt.Chord)).toBe(2)
    expect(encodeNtt(Ntt.Bass)).toBe(3)
  })

  it("maps style channels like StyleMakerTypes.h", () => {
    expect(styleChannel(StyleMakerLane.Rhythm1)).toBe(9)
    expect(styleChannel(StyleMakerLane.Bass)).toBe(11)
    expect(styleChannel(StyleMakerLane.Chord1)).toBe(12)
  })

  it("parses and patches a Bass Ctab in place", () => {
    const casm = buildMinimalCasm()
    const model = parseCasm(casm)
    expect(model.valid).toBe(true)
    expect(model.csegGroups).toHaveLength(1)
    expect(model.csegGroups[0].sdec.partNames).toEqual(["Main A"])
    expect(model.csegGroups[0].ctabEntries[0].sourceChannel).toBe(11)
    expect(model.csegGroups[0].ctabEntries[0].destinationChannel).toBe(11)
    expect(model.csegGroups[0].ctabEntries[0].zone.ntr).toBe(Ntr.RootTrans)

    const patched = patchCtab(
      casm,
      11,
      {
        ntr: Ntr.RootFixed,
        ntt: Ntt.Bypass,
        bassOn: false,
        retrigger: RetriggerRule.Stop,
      },
      "Main A",
    )
    expect(patched.ok).toBe(true)
    expect(patched.recordsPatched).toBe(1)
    expect(patched.data.length).toBe(casm.length)

    const again = parseCasm(patched.data)
    expect(again.csegGroups[0].ctabEntries[0].zone.ntr).toBe(Ntr.RootFixed)
    expect(again.csegGroups[0].ctabEntries[0].zone.ntt).toBe(Ntt.Bypass)
  })
})
