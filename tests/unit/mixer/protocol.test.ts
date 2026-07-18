import { describe, expect, it } from "vitest"
import {
  MIXER_PROFILES,
  MULTI_PART_OFFSET,
  bulkReply,
  channelsForProtocolPart,
  decodeMixerMessage,
  labelForChannel,
  parameterMessage,
  partsForBank,
  protocolPartForChannel,
  voiceMessages,
  xgDumpRequest,
} from "@/lib/mixer/protocol"

describe("mixer protocol goldens", () => {
  it("matches current desktop YamahaProtocol and YamahaSysExBuilder bytes", () => {
    expect([...xgDumpRequest(0)]).toEqual([0xf0, 0x43, 0x20, 0x4c, 0x08, 0x00, 0x00, 0xf7])
    expect([...parameterMessage(1, "volume", 100)]).toEqual([
      0xf0, 0x43, 0x10, 0x4c, 0x08, 0x01, 0x0b, 100, 0xf7,
    ])
    expect([...parameterMessage(1, "pan", 64)]).toEqual([
      0xf0, 0x43, 0x10, 0x4c, 0x08, 0x01, 0x0e, 64, 0xf7,
    ])
    expect([...parameterMessage(1, "reverb", 40)]).toEqual([
      0xf0, 0x43, 0x10, 0x4c, 0x08, 0x01, 0x13, 40, 0xf7,
    ])
    expect([...parameterMessage(1, "chorus", 41)]).toEqual([
      0xf0, 0x43, 0x10, 0x4c, 0x08, 0x01, 0x12, 41, 0xf7,
    ])
    expect([...parameterMessage(17, "volume", 100)]).toEqual([0xb0, 7, 100])
    expect([...parameterMessage(32, "pan", 64)]).toEqual([0xbf, 10, 64])
  })

  it("preserves the exact A05 framing evidence without adopting its obsolete offsets", () => {
    const a05 = {
      identityRequestBody: [126, 127, 6, 1],
      modelNameRequestBody: [67, 32, 76, 0, 0, 0],
      channel1BulkRequestBody: [67, 32, 76, 8, 0, 0],
      legacyPanBody: [67, 16, 16, 8, 0, 12, 64, 247],
      legacyReverbBody: [67, 16, 16, 8, 0, 13, 40, 247],
    }
    expect(a05.identityRequestBody).toEqual([0x7e, 0x7f, 0x06, 0x01])
    expect(a05.modelNameRequestBody).toEqual([...xgDumpRequest(0)].slice(1, 4).concat([0, 0, 0]))
    expect(a05.channel1BulkRequestBody).toEqual([...xgDumpRequest(0)].slice(1, -1))
    expect(a05.legacyPanBody[5]).toBe(0x0c)
    expect(a05.legacyReverbBody[5]).toBe(0x0d)
    expect(MULTI_PART_OFFSET.pan).toBe(0x0e)
    expect(MULTI_PART_OFFSET.reverb).toBe(0x13)
  })

  it("uses exact 32-channel labels, ports, and shared part 0x08 mapping", () => {
    expect([1, 4, 8, 9, 16, 17, 32].map(labelForChannel)).toEqual([
      "Right 1",
      "Left",
      "Multi Pad 4",
      "Rhythm 1",
      "Phrase 2",
      "Song 1",
      "Song 16",
    ])
    expect([1, 8, 9, 16, 17, 32].map(protocolPartForChannel)).toEqual([
      0x01, 0x08, 0x08, 0x0f, 0x00, 0x0f,
    ])
    expect(channelsForProtocolPart("port2", 0x08)).toEqual([8, 9])
    expect(channelsForProtocolPart("port1", 0x08)).toEqual([25])
    expect(partsForBank("style")).toEqual(Array.from({ length: 15 }, (_, index) => index + 1))
    expect(partsForBank("song")).toEqual(Array.from({ length: 16 }, (_, index) => index))
  })

  it("builds Yamaha-convention voice writes for both banks", () => {
    expect(voiceMessages(9, { msb: 8, lsb: 10, program: 4 }).map((message) => Array.from(message))).toEqual([
      [0xf0, 0x43, 0x10, 0x4c, 0x08, 0x08, 0x01, 8, 0xf7],
      [0xf0, 0x43, 0x10, 0x4c, 0x08, 0x08, 0x02, 10, 0xf7],
      [0xf0, 0x43, 0x10, 0x4c, 0x08, 0x08, 0x03, 3, 0xf7],
    ])
    expect(voiceMessages(17, { msb: 8, lsb: 10, program: 4 }).map((message) => Array.from(message))).toEqual([
      [0xb0, 0, 8],
      [0xb0, 32, 10],
      [0xc0, 3],
    ])
  })

  it("validates and decodes Yamaha bulk replies", () => {
    const payload = Uint8Array.from({ length: 20 }, (_, index) => index)
    const message = bulkReply(0x08, payload)
    expect(decodeMixerMessage(message)).toEqual({
      kind: "bulk",
      part: 0x08,
      startOffset: 0,
      payload,
    })
    const corrupted = Uint8Array.from(message)
    corrupted[10] ^= 1
    expect(decodeMixerMessage(corrupted)).toBeNull()
  })
})

describe("mixer model profiles", () => {
  it("covers every requested model and marks unverified differences UNKNOWN", () => {
    expect(Object.keys(MIXER_PROFILES).sort()).toEqual(["genos", "genos2", "tyros4", "tyros5"])
    Object.values(MIXER_PROFILES).forEach((profile) => {
      expect(profile.xgModelByte).toBe(0x4c)
      expect(profile.stylePort).toBe("port2")
      expect(profile.songPort).toBe("port1")
    })
    expect(MIXER_PROFILES.tyros4.protocolDifference).toBe("unknown")
    expect(MIXER_PROFILES.genos.protocolDifference).toBe("none-in-repository")
  })
})
