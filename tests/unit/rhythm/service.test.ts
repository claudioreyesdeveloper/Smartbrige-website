import { describe, expect, it, vi } from "vitest"
import type { PrivateEngineClient } from "@/lib/engine-proxy/client"
import { createMemoryRhythmService } from "@/lib/rhythm/service"

const project = {
  id: "proj_1",
  title: "Song",
  revisionId: "rev_7",
  version: 7,
  createdAt: "2026-07-18T00:00:00.000Z",
  updatedAt: "2026-07-18T00:00:00.000Z",
  document: {
    schemaVersion: 1 as const,
    song: {
      title: "Song",
      tempo: 120,
      key: "C",
      sections: [{
        id: "sec_1",
        name: "Verse",
        stylePart: "mainA" as const,
        bars: 2,
        chords: [
          { symbol: "C", startBeat: 0, durationBeats: 2 },
          { symbol: "F", startBeat: 2, durationBeats: 2 },
          { symbol: "G", startBeat: 4, durationBeats: 4 },
        ],
      }],
    },
  },
}

function setup() {
  const rhythmQuery = vi.fn(async () => ({
    queryId: "qry_1",
    expiresAt: "2026-07-18T12:15:00.000Z",
    candidates: [],
  }))
  const rhythmRender = vi.fn(async () => ({
    renders: [{
      renderReferenceId: "rnd_1",
      recipeReferenceId: "rcp_1",
      part: "bass" as const,
      durationMs: 4000,
      renderedSmf: "TVRoZAAAAAYAAQABA8BNVHJrAAAABAD/LwA=",
      playback: {
        channel: 11,
        kind: "mega-voice" as const,
        label: "Bass voice",
        bankMsb: 8,
        bankLsb: 0,
        programYamaha: 18,
      },
    }],
  }))
  const engine = {
    rhythmOptions: vi.fn(async () => ({ genres: [], sectionTypes: [], feels: [] })),
    rhythmQuery,
    rhythmFills: vi.fn(async () => ({
      queryId: "fqy_1",
      expiresAt: "2026-07-18T12:15:00.000Z",
      fills: [],
    })),
    rhythmRender,
  } as unknown as PrivateEngineClient
  const loadProject = vi.fn(async () => structuredClone(project))
  const built = createMemoryRhythmService({
    engineClient: engine,
    loadProject,
    requireEntitlement: vi.fn(async () => undefined),
    config: {
      baseUrl: new URL("https://private.invalid"),
      signingSecret: "secret",
      dailyLimit: 100,
      perMinuteLimit: 100,
      maxSkewSeconds: 60,
    },
  })
  return { ...built, rhythmQuery, rhythmRender, loadProject }
}

describe("RhythmService", () => {
  it("injects owned identity and fractional project chords into the private request", async () => {
    const { service, rhythmQuery, loadProject } = setup()
    await service.query("subject_1", {
      projectId: "proj_1",
      sectionId: "sec_1",
      contextRevision: "rev_7",
      kind: "bass",
      mode: "browse",
      filters: {},
      limit: 20,
    })
    expect(loadProject).toHaveBeenCalledWith("subject_1", "proj_1")
    expect(rhythmQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectId: "subject_1",
        projectId: "proj_1",
        context: expect.objectContaining({
          timeSignature: { numerator: 4, denominator: 4 },
          chords: [
            { symbol: "C", startBar: 0, durationBars: 0.5 },
            { symbol: "F", startBar: 0.5, durationBars: 0.5 },
            { symbol: "G", startBar: 1, durationBars: 1 },
          ],
        }),
      }),
    )
  })

  it("derives the 4/4 render contract and audits render quota usage", async () => {
    const { service, rhythmRender, usage } = setup()
    await service.render("subject_1", {
      projectId: "proj_1",
      sectionId: "sec_1",
      contextRevision: "rev_7",
      model: "genos2",
      operation: "apply",
      bassCandidateId: "rhy_1",
    })
    expect(rhythmRender).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectId: "subject_1",
        projectId: "proj_1",
        context: expect.objectContaining({
          sectionType: "verse",
          timeSignature: { numerator: 4, denominator: 4 },
        }),
      }),
    )
    expect(usage.events).toEqual([
      expect.objectContaining({ operation: "rhythm_render", status: "completed" }),
    ])
  })

  it("rejects stale context before any private engine call", async () => {
    const { service, rhythmQuery } = setup()
    await expect(
      service.query("subject_1", {
        projectId: "proj_1",
        sectionId: "sec_1",
        contextRevision: "rev_stale",
        kind: "drums",
        mode: "browse",
        filters: {},
        limit: 10,
      }),
    ).rejects.toMatchObject({ code: "validation" })
    expect(rhythmQuery).not.toHaveBeenCalled()
  })
})
