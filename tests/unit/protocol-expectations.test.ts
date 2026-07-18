import { describe, expect, it } from "vitest"
import {
  ARRANGER_COMMANDS,
  chordOnMessages,
  mainCommand,
  tempoCommand,
} from "@/lib/demo/yamaha/commands"
import { IDENTITY_REPLIES, PROTOCOL } from "../browser/protocol/expectations"
import { bytesToHex, decodeMidi } from "../browser/protocol/decode"

describe("protocol expectations ↔ application modules", () => {
  it("Main A–D bytes match commands.mainCommand", () => {
    for (const letter of ["A", "B", "C", "D"] as const) {
      expect(PROTOCOL.main(letter).bytes).toEqual(Array.from(mainCommand(letter)))
      expect(decodeMidi(PROTOCOL.main(letter).bytes)).toBe(`Yamaha Main ${letter}`)
    }
  })

  it("arranger start/stop and transport match ARRANGER_COMMANDS", () => {
    expect(PROTOCOL.arrangerStart.bytes).toEqual(Array.from(ARRANGER_COMMANDS.start))
    expect(PROTOCOL.arrangerStop.bytes).toEqual(Array.from(ARRANGER_COMMANDS.stop))
    expect(PROTOCOL.midiStart.bytes).toEqual([0xfa])
    expect(PROTOCOL.midiStop.bytes).toEqual([0xfc])
    expect(PROTOCOL.intro1.bytes).toEqual(Array.from(ARRANGER_COMMANDS.intro1))
  })

  it("tempo and chord-on match commands helpers", () => {
    expect(PROTOCOL.tempo(120).bytes).toEqual(Array.from(tempoCommand(120)))
    expect(PROTOCOL.chordOnC().map((f) => f.bytes)).toEqual(
      chordOnMessages("C").map((m) => Array.from(m)),
    )
  })

  it("identity replies use catalog-verified families only", () => {
    expect(IDENTITY_REPLIES.genos2.bytes.slice(5, 8)).toEqual([0x43, 0x7f, 0x68])
    expect(IDENTITY_REPLIES.genosFamily.bytes.slice(5, 8)).toEqual([0x43, 0x7f, 0x5e])
    expect(IDENTITY_REPLIES.tyros5.bytes.slice(5, 8)).toEqual([0x43, 0x7f, 0x7f])
    expect(IDENTITY_REPLIES.genosCaptured.bytes.slice(5, 9)).toEqual([0x43, 0x00, 0x44, 0x42])
  })

  it("hex helper formats stably", () => {
    expect(bytesToHex([0xf0, 0x43, 0x7e, 0x00, 0x09, 0x7f, 0xf7])).toBe(
      "F0 43 7E 00 09 7F F7",
    )
  })
})
