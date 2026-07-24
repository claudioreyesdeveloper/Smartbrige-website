import { describe, expect, it } from "vitest"
import {
  applyBassAuditionTransforms,
  applyDrumMappingToNotes,
  bassBpmMatchesTempoBand,
  drumKitChannelOverrideForCategory,
  findBassProfileIndexByName,
  remapDrumNoteForMode,
  remapDrumVelocityForMode,
  resolveDrumAuditionChannel,
  resolveDrumMappingMode,
  sectionLooksLikeFill,
  shouldUseRawDrumNotesForCategory,
  timeFeelFactor,
  DRUM_AUTO_CHANNEL,
  DRUM_SECTION_OPTIONS,
} from "@/lib/style-maker/library-panel"
import { applyDrumMappingToEvents } from "@/lib/style-maker/audition"
import { normalizeDrumSectionType } from "@/lib/style-maker/drum-section-types"
import { applyBassAuditionEventTransforms } from "@/lib/style-maker/audition"
import {
  browseLocalClips,
  localFacets,
  localLibraryAvailable,
} from "@/lib/style-maker/local-library"

describe("library panel helpers", () => {
  it("matches desktop tempo bands", () => {
    expect(bassBpmMatchesTempoBand(80, 1)).toBe(true)
    expect(bassBpmMatchesTempoBand(80, 2)).toBe(true)
    expect(bassBpmMatchesTempoBand(90, 2)).toBe(false)
    expect(bassBpmMatchesTempoBand(100, 3)).toBe(true)
    expect(bassBpmMatchesTempoBand(130, 3)).toBe(true)
    expect(bassBpmMatchesTempoBand(140, 4)).toBe(true)
    expect(bassBpmMatchesTempoBand(null, 4)).toBe(true)
  })

  it("maps time-feel combo ids to tick scale factors", () => {
    expect(timeFeelFactor(1)).toBe(2)
    expect(timeFeelFactor(2)).toBe(1)
    expect(timeFeelFactor(3)).toBe(0.5)
  })

  it("applies bass time/vel/dead transforms", () => {
    const notes = applyBassAuditionTransforms(
      [
        { tick: 100, duration: 50, note: 36, velocity: 70 },
        { tick: 200, duration: 50, note: 36, velocity: 100 },
      ],
      {
        timeFeelFactor: 2,
        sustainVelocityDelta: 10,
        deadVelocityDelta: -5,
      },
    )
    expect(notes[0]).toMatchObject({ tick: 200, duration: 100, velocity: 80 })
    expect(notes[1]).toMatchObject({ tick: 400, duration: 100, velocity: 95 })
  })

  it("remaps bass velocities for the selected MegaVoice", () => {
    // ElJazzSlapCompatible is slap-only: open 70 → +20 boost → 80
    const slapIdx = findBassProfileIndexByName("ElJazzSlapCompatible")
    expect(slapIdx).toBeGreaterThan(0)
    const notes = applyBassAuditionTransforms(
      [{ tick: 0, duration: 10, note: 36, velocity: 70 }],
      {
        timeFeelFactor: 1,
        sustainVelocityDelta: 0,
        deadVelocityDelta: 0,
        targetProfileIndex: slapIdx,
      },
    )
    expect(notes[0].velocity).toBe(80)
  })

  it("remaps Ambient hats exactly like LibraryPhraseService", () => {
    expect(remapDrumNoteForMode(42, "ambient")).toBe(15)
    expect(remapDrumNoteForMode(44, "ambient")).toBe(18)
    expect(remapDrumNoteForMode(46, "ambient")).toBe(17)
    expect(remapDrumNoteForMode(36, "ambient")).toBe(36)
    expect(remapDrumNoteForMode(42, "gm")).toBe(42)
    expect(remapDrumVelocityForMode(15, 80, "ambient")).toBe(100)
    expect(remapDrumVelocityForMode(36, 80, "ambient")).toBe(80)
    expect(remapDrumVelocityForMode(15, 80, "gm")).toBe(80)

    const notes = applyDrumMappingToNotes(
      [
        { tick: 0, duration: 10, note: 42, velocity: 80 },
        { tick: 10, duration: 10, note: 36, velocity: 90 },
      ],
      "ambient",
    )
    expect(notes[0]).toMatchObject({ note: 15, velocity: 100 })
    expect(notes[1]).toMatchObject({ note: 36, velocity: 90 })

    const events = applyDrumMappingToEvents(
      [
        { tick: 0, status: 0x99, data: [42, 80] },
        { tick: 5, status: 0x89, data: [42, 0] },
      ],
      "ambient",
    )
    expect(events[0].data).toEqual([15, 100])
    expect(events[1].data).toEqual([15, 0])
  })

  it("forces GM for non-Genos and cinematic/action packs", () => {
    expect(shouldUseRawDrumNotesForCategory("Cinematic Percussion")).toBe(true)
    expect(shouldUseRawDrumNotesForCategory("Pop")).toBe(false)
    expect(resolveDrumMappingMode("ambient", "Pop", true)).toBe("ambient")
    expect(resolveDrumMappingMode("ambient", "Pop", false)).toBe("gm")
    expect(
      resolveDrumMappingMode("ambient", "action_drums", true),
    ).toBe("gm")
  })

  it("resolves drum Auto channel to Rhythm 2 (ch 10) for all categories", () => {
    expect(drumKitChannelOverrideForCategory("Funk Percussion")).toBe(null)
    expect(drumKitChannelOverrideForCategory("action_drums")).toBe(null)
    expect(drumKitChannelOverrideForCategory("Latin Tumbao")).toBe(null)
    expect(drumKitChannelOverrideForCategory("Pop")).toBe(null)
    expect(resolveDrumAuditionChannel(DRUM_AUTO_CHANNEL, "funk_percussion")).toBe(10)
    expect(resolveDrumAuditionChannel(DRUM_AUTO_CHANNEL, "Pop")).toBe(10)
    expect(resolveDrumAuditionChannel(11, "funk_percussion")).toBe(11)
  })

  it("detects fill section types for groove stripping", () => {
    expect(sectionLooksLikeFill("fill")).toBe(true)
    expect(sectionLooksLikeFill("fill_ins")).toBe(true)
    expect(sectionLooksLikeFill("fills_+_breaks")).toBe(true)
    expect(sectionLooksLikeFill("verse")).toBe(false)
  })

  it("normalizes drum sections onto the six UI types", () => {
    expect(normalizeDrumSectionType("fill")).toBe("fill_ins")
    expect(normalizeDrumSectionType("pickup")).toBe("fill_ins")
    expect(normalizeDrumSectionType("ending")).toBe("bridge")
    expect(normalizeDrumSectionType("tumbao_swing")).toBe("verse")
    expect(normalizeDrumSectionType("pre chorus")).toBe("pre_chorus")
    const ids = DRUM_SECTION_OPTIONS.map((o) => o.id).filter(Boolean)
    expect(ids).toEqual([
      "intro",
      "verse",
      "pre_chorus",
      "chorus",
      "bridge",
      "fill_ins",
    ])
  })

  it("scales audition preview event ticks and velocities", () => {
    const events = applyBassAuditionEventTransforms(
      [
        { tick: 10, status: 0x9a, data: [36, 70] },
        { tick: 20, status: 0x9a, data: [36, 100] },
        { tick: 30, status: 0x8a, data: [36, 0] },
      ],
      {
        timeFeelFactor: 0.5,
        sustainVelocityDelta: -10,
        deadVelocityDelta: 5,
      },
    )
    expect(events[0]).toMatchObject({ tick: 5, data: [36, 60] })
    expect(events[1]).toMatchObject({ tick: 10, data: [36, 105] })
    expect(events[2]).toMatchObject({ tick: 15, data: [36, 0] })
  })
})

describe("local library query parity", () => {
  it("filters feel_mode and excludes fill sections for drums", () => {
    if (!localLibraryAvailable()) return

    const all = browseLocalClips({
      sourceKind: "drums",
      limit: 50,
      offset: 0,
    })
    expect(all.clips.length).toBeGreaterThan(0)

    const noFills = browseLocalClips({
      sourceKind: "drums",
      excludeFillSections: true,
      limit: 200,
      offset: 0,
    })
    expect(
      noFills.clips.every((clip) => !sectionLooksLikeFill(clip.sectionType)),
    ).toBe(true)

    const swing = browseLocalClips({
      sourceKind: "bass",
      feelMode: "swing",
      limit: 20,
      offset: 0,
    })
    expect(
      swing.clips.every(
        (clip) => (clip.feelMode || "").toLowerCase() === "swing",
      ),
    ).toBe(true)
  })

  it("stores only the six drum UI section types in the local DB", () => {
    if (!localLibraryAvailable()) return
    const facets = localFacets("drums")
    expect(facets.categories.length).toBeGreaterThan(0)
    const allowed = new Set(
      DRUM_SECTION_OPTIONS.map((o) => o.id).filter(Boolean),
    )
    for (const section of facets.sections) {
      expect(allowed.has(section)).toBe(true)
    }
    const fills = browseLocalClips({
      sourceKind: "drums",
      sectionType: "fill_ins",
      limit: 20,
      offset: 0,
    })
    expect(fills.clips.length).toBeGreaterThan(0)
    expect(fills.clips.every((c) => c.sectionType === "fill_ins")).toBe(true)
  })

  it("allows browsing up to 500 clips", () => {
    if (!localLibraryAvailable()) return
    const page = browseLocalClips({
      sourceKind: "bass",
      limit: 500,
      offset: 0,
    })
    expect(page.clips.length).toBeGreaterThan(0)
    expect(page.clips.length).toBeLessThanOrEqual(500)
  })
})
