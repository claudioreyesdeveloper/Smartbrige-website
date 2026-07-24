import { describe, expect, it } from "vitest"
import {
  applyPartTypeChoice,
  guitarCasmModeName,
  isYamahaGuitarSourceMode,
  laneAccepts,
  laneNeedsPartTypePrompt,
  partTypeChoicesForLane,
  StyleMakerGuitarCasmMode,
  StyleMakerLane,
} from "@/lib/style-maker/lanes"
import {
  nttForGuitarCasmMode,
  templateSourceForGeneratedRecord,
  type StyleMakerCasmRecordLite,
} from "@/lib/style-maker/native-export"
import { patchForGeneratedWrittenLane } from "@/lib/style-maker/template"
import { Ntr, Ntt, RetriggerRule } from "@/lib/style-maker/casm/model"

describe("StyleMakerLanes accepts + part type (desktop verbatim)", () => {
  it("accepts source kinds per lane like StyleMakerTypes.h", () => {
    expect(laneAccepts(StyleMakerLane.Rhythm1, "drums").ok).toBe(true)
    expect(laneAccepts(StyleMakerLane.Rhythm1, "bass").ok).toBe(false)
    expect(laneAccepts(StyleMakerLane.Bass, "bass").ok).toBe(true)
    expect(laneAccepts(StyleMakerLane.Chord1, "guitar").ok).toBe(true)
    expect(laneAccepts(StyleMakerLane.Chord2, "brass").ok).toBe(true)
    expect(laneAccepts(StyleMakerLane.Chord1, "bass").ok).toBe(false)
    expect(laneAccepts(StyleMakerLane.Pad, "pad").ok).toBe(true)
    expect(laneAccepts(StyleMakerLane.Pad, "guitar").ok).toBe(true)
    expect(laneAccepts(StyleMakerLane.Phrase1, "solo").ok).toBe(true)
    expect(laneAccepts(StyleMakerLane.Phrase2, "brass").ok).toBe(true)
    expect(laneAccepts(StyleMakerLane.Phrase1, "drums").ok).toBe(false)
  })

  it("prompts part type only for Chord/Pad/Phrase lanes", () => {
    expect(laneNeedsPartTypePrompt(StyleMakerLane.Bass)).toBe(false)
    expect(laneNeedsPartTypePrompt(StyleMakerLane.Chord1)).toBe(true)
    expect(laneNeedsPartTypePrompt(StyleMakerLane.Chord2)).toBe(true)
    expect(laneNeedsPartTypePrompt(StyleMakerLane.Pad)).toBe(true)
    expect(laneNeedsPartTypePrompt(StyleMakerLane.Phrase1)).toBe(true)
  })

  it("applies BuildTab::applyPartTypeChoice verbatim", () => {
    expect(applyPartTypeChoice(StyleMakerLane.Pad, 1, "guitar")).toEqual({
      sourceKind: "pad",
      guitarMode: StyleMakerGuitarCasmMode.RenderedMegaVoice,
    })
    expect(applyPartTypeChoice(StyleMakerLane.Chord1, 1, "guitar")).toEqual({
      sourceKind: "brass",
      guitarMode: StyleMakerGuitarCasmMode.RenderedMegaVoice,
    })
    expect(applyPartTypeChoice(StyleMakerLane.Chord2, 3, "guitar")).toEqual({
      sourceKind: "guitar",
      guitarMode: StyleMakerGuitarCasmMode.YamahaSourceStrum,
    })
    expect(applyPartTypeChoice(StyleMakerLane.Phrase1, 1, "guitar")).toEqual({
      sourceKind: "solo",
      guitarMode: StyleMakerGuitarCasmMode.RenderedMegaVoice,
    })
    expect(applyPartTypeChoice(StyleMakerLane.Phrase2, 5, "brass")).toEqual({
      sourceKind: "guitar",
      guitarMode: StyleMakerGuitarCasmMode.YamahaSourceArpeggio,
    })
  })

  it("keeps desktop part-type labels", () => {
    expect(partTypeChoicesForLane(StyleMakerLane.Chord1)[0]).toBe(
      "Chord comp / keys",
    )
    expect(partTypeChoicesForLane(StyleMakerLane.Pad)[0]).toBe("Pad / sustained")
    expect(partTypeChoicesForLane(StyleMakerLane.Phrase1)).toHaveLength(6)
    expect(guitarCasmModeName(StyleMakerGuitarCasmMode.YamahaSourceMixed)).toBe(
      "Yamaha Guitar source - Mixed",
    )
    expect(
      isYamahaGuitarSourceMode(StyleMakerGuitarCasmMode.RenderedMegaVoice),
    ).toBe(false)
    expect(
      isYamahaGuitarSourceMode(StyleMakerGuitarCasmMode.YamahaSourceStrum),
    ).toBe(true)
  })
})

describe("StyleNativeExporter lane CASM patches", () => {
  it("maps guitar CASM modes to Yamaha guitar NTT tables", () => {
    expect(nttForGuitarCasmMode(StyleMakerGuitarCasmMode.YamahaSourceStrum)).toBe(
      Ntt.GuitarStroke,
    )
    expect(
      nttForGuitarCasmMode(StyleMakerGuitarCasmMode.YamahaSourceArpeggio),
    ).toBe(Ntt.GuitarArpeggio)
    expect(nttForGuitarCasmMode(StyleMakerGuitarCasmMode.YamahaSourceMixed)).toBe(
      Ntt.GuitarAllPurpose,
    )
  })

  it("uses desktop patchForGeneratedWrittenLane rules per lane", () => {
    const bass = patchForGeneratedWrittenLane(StyleMakerLane.Bass, 11, false)
    expect(bass.ntr).toBe(Ntr.RootTrans)
    expect(bass.ntt).toBe(Ntt.Melody)
    expect(bass.bassOn).toBe(true)
    expect(bass.retrigger).toBe(RetriggerRule.PitchShiftToRoot)

    const chord = patchForGeneratedWrittenLane(StyleMakerLane.Chord2, 12, false)
    expect(chord.ntr).toBe(Ntr.RootFixed)
    expect(chord.ntt).toBe(Ntt.Chord)
    expect(chord.retrigger).toBe(RetriggerRule.Stop)

    const pad = patchForGeneratedWrittenLane(StyleMakerLane.Pad, 13, false)
    expect(pad.ntr).toBe(Ntr.RootFixed)
    expect(pad.ntt).toBe(Ntt.Chord)
    expect(pad.retrigger).toBe(RetriggerRule.PitchShift)

    const phrase = patchForGeneratedWrittenLane(StyleMakerLane.Phrase1, 14, false)
    expect(phrase.ntr).toBe(Ntr.RootTrans)
    expect(phrase.ntt).toBe(Ntt.Melody)
    expect(phrase.retrigger).toBe(RetriggerRule.Stop)
  })

  it("picks templateSourceForGeneratedRecord like desktop Pad/Phrase fallbacks", () => {
    const records: StyleMakerCasmRecordLite[] = [
      {
        lane: StyleMakerLane.Chord1,
        sourceChannel: 12,
        destinationChannel: 12,
        sourceChordIsMinor: false,
      },
      {
        lane: StyleMakerLane.Rhythm1,
        sourceChannel: 10,
        destinationChannel: 10,
        sourceChordIsMinor: false,
      },
    ]
    expect(
      templateSourceForGeneratedRecord(records, StyleMakerLane.Pad, false),
    ).toBe(12)
    expect(
      templateSourceForGeneratedRecord(records, StyleMakerLane.Phrase2, false),
    ).toBe(12)
    expect(
      templateSourceForGeneratedRecord(records, StyleMakerLane.Bass, false),
    ).toBe(12) // non-rhythm fallback
  })
})
