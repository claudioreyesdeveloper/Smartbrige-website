import { describe, expect, it, vi } from "vitest"
import { createProductionLyricsAdapters } from "@/components/lyrics/production"
import { persistSoloSelection } from "@/components/solo-phrases/production"
import { createProjectSession } from "@/lib/projects/client"

const baseDocument = {
  schemaVersion: 1 as const,
  song: {
    title: "Song",
    tempo: 120,
    key: "C",
    sections: [],
  },
}

function detail(revisionId: string, version: number, document = baseDocument) {
  return {
    id: "project_1",
    title: "Song",
    revisionId,
    version,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    document,
  }
}

describe("creative production project adapters", () => {
  it("persists only opaque Solo references and display labels", async () => {
    let savedBody: Record<string, unknown> | undefined
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PUT") {
        savedBody = JSON.parse(String(init.body)) as Record<string, unknown>
        const document = savedBody.document as typeof baseDocument
        return Response.json({ project: detail("revision_2", 2, document) })
      }
      return Response.json({ project: detail("revision_1", 1) })
    })
    const session = createProjectSession({ fetch: fetchMock, autosaveDelayMs: 60_000 })

    await persistSoloSelection(session, {
      projectId: "project_1",
      instrumentLabel: "Alto Sax",
      styleLabel: "Smooth Jazz",
      render: {
        renderId: "render_opaque_1",
        recipeId: "recipe_opaque_1",
        durationMs: 8000,
        renderedSmf: "TVRoZAAAAAYAAQACA8BNVHJrAAAACwD/UQMHoSAA/y8ATVRyawAAAA0AkSRQgXCBJAAA/y8A",
        playback: {
          channel: 1,
          kind: "channel-current",
          label: "Alto Sax",
          bankMsb: null,
          bankLsb: null,
          programYamaha: null,
        },
      },
    })

    expect(savedBody?.document).toMatchObject({
      solos: [{
        id: "render_opaque_1",
        instrument: "Alto Sax",
        style: "Smooth Jazz",
        selected: true,
        recipe: {
          sourceId: "recipe_opaque_1",
          engineVersion: "opaque-solo-v1",
          renderBlobId: "render_opaque_1",
        },
      }],
    })
    expect(JSON.stringify(savedBody)).not.toContain("renderedSmf")
    expect(JSON.stringify(savedBody)).not.toContain("takeId")
  })

  it("persists editable Lyrics state and references without rendered export bytes", async () => {
    let savedBody: Record<string, unknown> | undefined
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input)
      if (url.includes("/api/engine/lyrics/fit")) {
        return Response.json({
          recipeReferenceId: "lyrics_recipe_1",
          renderReferenceId: "lyrics_render_1",
          phrases: [{
            phraseId: "phrase_1",
            words: ["we", "go", "home"],
            syllables: ["we", "go", "home"],
            assignments: [{ noteId: "note_1", lyric: "we" }],
          }],
          renderedExport: "TVRoZAAAAAYAAAAAAeA=",
        })
      }
      if (init?.method === "PUT") {
        savedBody = JSON.parse(String(init.body)) as Record<string, unknown>
        return Response.json({
          project: detail("revision_2", 2, savedBody.document as typeof baseDocument),
        })
      }
      return Response.json({ project: detail("revision_1", 1) })
    })
    const session = createProjectSession({ fetch: fetchMock, autosaveDelayMs: 60_000 })
    const adapters = createProductionLyricsAdapters({ fetch: fetchMock, projects: session })
    const fit = await adapters.lyrics.fit({
      projectId: "project_1",
      contextRevision: "revision_1",
      ppq: 480,
      tempoBpm: 120,
      key: "C",
      timeSignature: { numerator: 4, denominator: 4 },
      chords: [{ symbol: "C", startBar: 0, durationBars: 1 }],
      notes: [{
        noteId: "note_1",
        pitch: 60,
        startTick: 0,
        durationTicks: 480,
        phraseId: "phrase_1",
      }],
      lines: [{ phraseId: "phrase_1", text: "we go home" }],
    })
    await adapters.lyrics.persistFit("project_1", fit)

    expect(savedBody?.document).toMatchObject({
      lyrics: {
        text: "we go home",
        syllables: [{ text: "we" }, { text: "go" }, { text: "home" }],
        recipeReferenceId: "lyrics_recipe_1",
        renderReferenceId: "lyrics_render_1",
      },
    })
    expect(JSON.stringify(savedBody)).not.toContain("renderedExport")
    expect(JSON.stringify(savedBody)).not.toContain("assignments")
  })

  it("surfaces one-document revision conflicts without overwriting", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PUT") {
        return Response.json({ error: "Revision conflict.", code: "conflict" }, { status: 409 })
      }
      return Response.json({ project: detail("revision_1", 1) })
    })
    const session = createProjectSession({ fetch: fetchMock, autosaveDelayMs: 60_000 })
    const adapters = createProductionLyricsAdapters({ fetch: fetchMock, projects: session })
    await expect(adapters.lyrics.persistDraft("project_1", {
      generationId: "generation_1",
      lines: [{ phraseId: "phrase_1", text: "local draft" }],
    })).rejects.toMatchObject({ code: "conflict" })
    expect(session.getSnapshot().conflict?.localDocument.lyrics?.text).toBe("local draft")
  })
})
