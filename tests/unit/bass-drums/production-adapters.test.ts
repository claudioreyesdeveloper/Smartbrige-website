import { describe, expect, it, vi } from "vitest"
import { createProductionBassDrumsAdapters } from "@/components/bass-drums/production"
import type { ProjectApiClient } from "@/lib/projects/client/api"

const detail = {
  id: "proj_1",
  title: "Song",
  revisionId: "rev_1",
  version: 1,
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
        bars: 4,
        chords: [{ symbol: "C", startBeat: 0, durationBeats: 16 }],
      }],
    },
  },
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("production rhythm adapters", () => {
  it("maps project context and sends only public opaque references", async () => {
    const bodies: Array<Record<string, unknown>> = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      bodies.push(body)
      if (path.endsWith("/options")) {
        return response({ genres: ["Funk"], sectionTypes: ["verse"], feels: ["straight"] })
      }
      if (path.endsWith("/query")) {
        return response({
          queryId: "qry_1",
          expiresAt: "2026-07-18T12:15:00.000Z",
          candidates: [{
            candidateId: "rhy_1",
            label: "Bass option 1",
            category: "Funk",
            feel: "straight",
            sectionType: "verse",
            bpm: 120,
            bars: 4,
            matchBand: "strong",
            qualityBand: "high",
          }],
        })
      }
      return response({
        renders: [{
          renderReferenceId: "rnd_1",
          recipeReferenceId: "rcp_1",
          part: "bass",
          durationMs: 8000,
          renderedSmf: "TVRoZAAAAAYAAQABA8BNVHJrAAAABAD/LwA=",
          playback: {
            channel: 11,
            kind: "mega-voice",
            label: "Bass voice",
            bankMsb: 8,
            bankLsb: 0,
            programYamaha: 18,
          },
        }],
      })
    })
    const projects = {
      list: vi.fn(async () => [{
        id: "proj_1",
        title: "Song",
        currentRevisionId: "rev_1",
        currentVersion: 1,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
      }]),
      open: vi.fn(async () => ({ detail, migrationApplied: false })),
    } as unknown as ProjectApiClient
    const adapters = createProductionBassDrumsAdapters({ fetch: fetchMock, projects })

    const mapped = await adapters.projects.list()
    expect(mapped[0]?.sections[0]).toMatchObject({
      id: "sec_1",
      contextRevision: "rev_1",
      chordContext: "C",
    })
    await adapters.library.getFilterOptions("bass", "proj_1")
    const result = await adapters.library.queryCandidates({
      projectId: "proj_1",
      sectionId: "sec_1",
      contextRevision: "rev_1",
      part: "bass",
      filters: { genre: "Funk", section: "All Sections", feel: "All Feels" },
    })
    const audition = await adapters.library.prepareAudition({
      projectId: "proj_1",
      sectionId: "sec_1",
      contextRevision: "rev_1",
      source: result.candidates[0]!.audition,
    })
    expect(audition).toMatchObject({
      renderReferenceId: "rnd_1",
      recipeReferenceId: "rcp_1",
    })
    expect(bodies).toEqual([
      { projectId: "proj_1", kind: "bass" },
      {
        projectId: "proj_1",
        sectionId: "sec_1",
        contextRevision: "rev_1",
        kind: "bass",
        mode: "browse",
        filters: { genre: "Funk" },
        limit: 20,
      },
      {
        projectId: "proj_1",
        sectionId: "sec_1",
        contextRevision: "rev_1",
        model: "genos2",
        operation: "audition",
        part: "bass",
        candidateId: "rhy_1",
      },
    ])
    for (const body of bodies) {
      expect(body).not.toHaveProperty("subjectId")
      expect(body).not.toHaveProperty("context")
      expect(body).not.toHaveProperty("recipe")
      expect(body).not.toHaveProperty("seed")
    }
  })

  it("maps quota and private failures to safe adapter errors", async () => {
    const projects = {
      list: vi.fn(async () => []),
      open: vi.fn(),
    } as unknown as ProjectApiClient
    const quota = createProductionBassDrumsAdapters({
      projects,
      fetch: async () => response({ code: "quota_exceeded", error: "Usage limit exceeded." }, 429),
    })
    await expect(quota.library.getFilterOptions("bass", "proj_1")).rejects.toMatchObject({
      code: "quota_exceeded",
    })
    const failure = createProductionBassDrumsAdapters({
      projects,
      fetch: async () => response({ error: "private stack", trace: "secret" }, 500),
    })
    await expect(failure.library.getFilterOptions("bass", "proj_1")).rejects.toMatchObject({
      code: "unavailable",
      message: "The rhythm service is temporarily unavailable.",
    })
  })
})
