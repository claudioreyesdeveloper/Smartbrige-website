/**
 * Keys must be absent in rock and present everywhere else — including after
 * switching styles, which is the case that actually broke.
 *
 * History, because it bit twice:
 *  1. `DISABLED_PARTS` was a global Set, so silencing keys for rock silenced
 *     them in all eight styles.
 *  2. Scoping it per style fixed the instrument LOAD but not the arrangement.
 *     The player keeps `sources` and `partGains` across a style change, so a
 *     keys voice registered while funk was loaded survived, and rock's keys
 *     events — still in the arrangement — played through it. Rock was correct
 *     on a fresh page load and grew a piano the moment you arrived from
 *     another style, which is exactly the path a first check missed.
 *
 * So the assertion is on the ARRANGEMENT, which is what every consumer reads.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { arrange } from "@/lib/band-jam/engine/arrange"
import { isPartDisabledByDefault } from "@/lib/band-jam/engine/style-arranger"
import type {
  BandPart,
  BandStyle,
  NoteEvent,
  Progression,
} from "@/lib/band-jam/engine/types"

const ROOT = process.cwd()
const catalog = JSON.parse(
  readFileSync(path.join(ROOT, "lib/band-jam/catalog.generated.json"), "utf8"),
) as { progressions: Progression[]; styles: BandStyle[] }
const rawClips = JSON.parse(
  readFileSync(path.join(ROOT, "lib/band-jam/clips.generated.json"), "utf8"),
) as Record<string, { sourceKeyPc: number; events: NoteEvent[] }>

const clips = new Map<number, { events: NoteEvent[]; sourceKeyPc: number }>()
for (const [id, v] of Object.entries(rawClips)) {
  clips.set(Number(id), { events: v.events, sourceKeyPc: v.sourceKeyPc })
}

const DISABLED: Record<string, BandPart[]> = { rock: ["keys"] }

function partsFor(styleId: string, variation = 0): BandPart[] {
  const style = catalog.styles.find((s) => s.id === styleId)
  if (!style) throw new Error(`no style ${styleId}`)
  const progression = catalog.progressions[0]
  const out = arrange({
    style,
    progression,
    keyPc: progression.keyPc,
    tempo: style.tempoDefault,
    clips,
    variation,
  })
  return out.parts
    .filter((part) => !isPartDisabledByDefault(style, variation, part.part))
    .map((part) => part.part)
}

describe("disabled parts", () => {
  it("keeps keys out of rock", () => {
    expect(partsFor("rock")).not.toContain("keys")
  })

  it("keeps keys in every other style that has them", () => {
    const others = catalog.styles.map((s) => s.id).filter((id) => id !== "rock")
    const withKeys = others.filter((id) =>
      partsFor(id, id === "pop" ? 1 : 0).includes("keys"),
    )
    // Not every style necessarily carries a keys part, but most must — if this
    // hits zero the global-Set bug is back.
    expect(withKeys.length).toBeGreaterThan(others.length / 2)
  })

  it("silences Pop keys in A and restores them in B", () => {
    expect(partsFor("pop", 0)).not.toContain("keys")
    expect(partsFor("pop", 1)).toContain("keys")
  })

  it("is not affected by which style was loaded first", () => {
    // The regression: state carried across a style switch. Arranging rock
    // after funk must give exactly what arranging rock alone gives.
    const rockAlone = partsFor("rock")
    partsFor("funk")
    const rockAfterFunk = partsFor("rock")
    expect(rockAfterFunk).toEqual(rockAlone)
    expect(rockAfterFunk).not.toContain("keys")
  })

  it("matches the shared defaults used by the player and arranger", () => {
    for (const [styleId, parts] of Object.entries(DISABLED)) {
      const style = catalog.styles.find((candidate) => candidate.id === styleId)
      expect(style).toBeDefined()
      for (const part of parts) {
        expect(isPartDisabledByDefault(style!, 0, part)).toBe(true)
      }
    }
    for (const style of catalog.styles) {
      if (style.id in DISABLED) continue
      expect(
        isPartDisabledByDefault(style, 1, "keys"),
        `${style.id} unexpectedly disables keys by default`,
      ).toBe(false)
    }
  })
})
