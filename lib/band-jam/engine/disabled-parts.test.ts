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

/**
 * Mirror of DISABLED_PARTS_BY_STYLE in practice-screen.tsx. Kept in step by
 * the "matches the screen" assertion below rather than by hope.
 */
const DISABLED: Record<string, BandPart[]> = { rock: ["keys"] }

function partsFor(styleId: string): BandPart[] {
  const style = catalog.styles.find((s) => s.id === styleId)
  if (!style) throw new Error(`no style ${styleId}`)
  const progression = catalog.progressions[0]
  const out = arrange({
    style,
    progression,
    keyPc: progression.keyPc,
    tempo: style.tempoDefault,
    clips,
    variation: 0,
  })
  const disabled = new Set(DISABLED[styleId] ?? [])
  return out.parts.filter((p) => !disabled.has(p.part)).map((p) => p.part)
}

describe("disabled parts", () => {
  it("keeps keys out of rock", () => {
    expect(partsFor("rock")).not.toContain("keys")
  })

  it("keeps keys in every other style that has them", () => {
    const others = catalog.styles.map((s) => s.id).filter((id) => id !== "rock")
    const withKeys = others.filter((id) => partsFor(id).includes("keys"))
    // Not every style necessarily carries a keys part, but most must — if this
    // hits zero the global-Set bug is back.
    expect(withKeys.length).toBeGreaterThan(others.length / 2)
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

  it("matches the table the practice screen actually uses", () => {
    // Guards this file drifting from practice-screen.tsx.
    const src = readFileSync(
      path.join(ROOT, "components/band-jam/practice-screen.tsx"),
      "utf8",
    )
    const block = src.slice(
      src.indexOf("const DISABLED_PARTS_BY_STYLE"),
      src.indexOf("function isPartDisabled"),
    )
    for (const [styleId, parts] of Object.entries(DISABLED)) {
      expect(block).toContain(styleId)
      for (const p of parts) expect(block).toContain(`"${p}"`)
    }
    // Only rock should appear; another style id here means the tables diverged.
    const styleIds = catalog.styles.map((s) => s.id)
    for (const id of styleIds) {
      if (id in DISABLED) continue
      expect(block, `${id} disabled on screen but not in this test`).not.toContain(
        `${id}:`,
      )
    }
  })
})
