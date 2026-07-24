import { describe, expect, it } from "vitest"
import { parseYamahaStyle } from "@/lib/demo/style-midi"
import { DRUM_KIT_CHOICES } from "@/lib/style-maker/megavoice-catalog"

function ascii(text: string) {
  return [...text].map((ch) => ch.charCodeAt(0))
}
function u32(value: number) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}

describe("style tempo + drum kit catalog", () => {
  it("reads Set Tempo meta from a style/MIDI file", () => {
    // 500000 us/qn = 120 BPM
    const tempo120 = [0, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20]
    // 400000 us/qn = 150 BPM (ignored — first tempo wins)
    const tempo150 = [0, 0xff, 0x51, 0x03, 0x06, 0x1a, 0x80]
    const track = [...tempo120, ...tempo150, 0, 0xff, 0x2f, 0]
    const bytes = Uint8Array.from([
      ...ascii("MThd"),
      0,
      0,
      0,
      6,
      0,
      0,
      0,
      1,
      0,
      96,
      ...ascii("MTrk"),
      ...u32(track.length),
      ...track,
    ])
    const style = parseYamahaStyle(bytes)
    expect(style.bpm).toBe(120)
  })

  it("loads DrumKit voices from the genos2 keyboard_voices snapshot", () => {
    expect(DRUM_KIT_CHOICES.length).toBe(80)
    expect(DRUM_KIT_CHOICES.some((k) => k.id === "StandardKit")).toBe(true)
    expect(DRUM_KIT_CHOICES.some((k) => k.id === "RockKit")).toBe(true)
    expect(DRUM_KIT_CHOICES.some((k) => k.id === "PopPercussionKit")).toBe(true)
    // BrushKit exists in DB as Legacy — allowed; invented kits must not appear
    expect(DRUM_KIT_CHOICES.every((k) => k.msb > 0 || k.programYamaha > 0)).toBe(true)
  })
})
