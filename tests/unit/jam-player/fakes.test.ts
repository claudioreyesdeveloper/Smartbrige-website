import { describe, expect, it } from "vitest"
import {
  createFakeCatalogClient,
  createFakeEngineClient,
  createFakeProjectSession,
  FIXTURE_SONGS,
} from "@/components/jam-player/fakes"

const FORBIDDEN = [
  "seed",
  "recipe",
  "score",
  "sourcePhrase",
  "pattern",
  "anticipation",
  "transition",
]

describe("Jam Player fake adapters", () => {
  it("preserves exact source section names and Main A–D assignments", async () => {
    const catalog = createFakeCatalogClient()
    const song = await catalog.getSong("song-coastal-drive")
    expect(song.sections.map((s) => s.label)).toEqual(["Verse", "Chorus", "Bridge"])
    expect(song.sections.map((s) => s.variation)).toEqual(["A", "B", "C"])
  })

  it("returns only display chords and opaque ids from reharmonize", async () => {
    const engine = createFakeEngineClient({ latencyMs: 0 })
    const response = await engine.reharmonize({
      projectId: "proj_1",
      model: "genos",
      song: FIXTURE_SONGS[0],
      key: "C",
      scope: "song",
    })

    expect(response.generationId).toMatch(/^gen_/)
    expect(response.candidates.length).toBeGreaterThan(0)
    for (const candidate of response.candidates) {
      expect(candidate.id).toBeTruthy()
      expect(candidate.label).toBeTruthy()
      const blob = JSON.stringify(candidate)
      for (const word of FORBIDDEN) {
        expect(blob.toLowerCase()).not.toContain(word.toLowerCase())
      }
    }
  })

  it("prepare plans expose opaque plan ids and dispatch events only", async () => {
    const engine = createFakeEngineClient({ latencyMs: 0 })
    const plan = await engine.prepare({
      projectId: "proj_1",
      model: "genos",
      song: FIXTURE_SONGS[0],
      key: "C",
      tempo: 112,
      styleId: "style-easypop",
      styleNumber: 12,
      loop: false,
    })

    expect(plan.planId).toMatch(/^plan_/)
    expect(plan.dispatch.fullSong[0]).toMatchObject({
      atMs: expect.any(Number),
      target: "port1",
      bytes: expect.any(String),
    })
    const blob = JSON.stringify(plan)
    for (const word of ["seed", "recipe", "sourcePhrase", "anticipation"]) {
      expect(blob.toLowerCase()).not.toContain(word.toLowerCase())
    }
  })

  it("saves and reopens project musical choices without recipe fields", async () => {
    const projects = createFakeProjectSession()
    const created = await projects.create("Harbor Edit")
    const saved = await projects.save({
      ...created,
      songId: "song-harbor-swing",
      key: "Bb",
      tempo: 140,
      styleId: "style-swingfox",
      loop: true,
      generationId: "gen_1",
      candidateId: "gen_1_c1",
      chordsBySection: {
        "sec-head": [{ beat: 0, duration: 4, name: "Bb6" }],
      },
    })

    const reopened = await projects.open(saved.id)
    expect(reopened.title).toBe("Harbor Edit")
    expect(reopened.tempo).toBe(140)
    expect(reopened.candidateId).toBe("gen_1_c1")
    expect(reopened).not.toHaveProperty("recipe")
    expect(reopened).not.toHaveProperty("seed")
  })
})
