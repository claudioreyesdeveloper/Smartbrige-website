import { beforeEach, describe, expect, it, vi } from "vitest"

const getSessionUserId = vi.fn<() => Promise<string | null>>()
const soloOptions = vi.fn()
const soloGenerate = vi.fn()
const soloRender = vi.fn()
const lyricGenerate = vi.fn()
const lyricFit = vi.fn()

vi.mock("@/lib/auth", () => ({
  getSessionUserId: () => getSessionUserId(),
}))
vi.mock("@/lib/creative/runtime", () => ({
  getCreativeService: () => ({
    soloOptions,
    soloGenerate,
    soloRender,
    lyricGenerate,
    lyricFit,
  }),
}))

function request(body: unknown) {
  return new Request("http://localhost/api/engine/creative", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("creative public proxy routes", () => {
  beforeEach(() => {
    getSessionUserId.mockReset()
    for (const mock of [soloOptions, soloGenerate, soloRender, lyricGenerate, lyricFit]) {
      mock.mockReset()
    }
  })

  it("rejects unauthenticated calls before parsing", async () => {
    getSessionUserId.mockResolvedValue(null)
    const { POST } = await import("@/app/api/engine/solo/options/route")
    const response = await POST(request({ subjectId: "attacker" }))
    expect(response.status).toBe(401)
    expect(response.headers.get("cache-control")).toBe("no-store, private")
    expect(soloOptions).not.toHaveBeenCalled()
  })

  it("strictly rejects browser identity, entitlement, context, and MIDI fields", async () => {
    getSessionUserId.mockResolvedValue("user_1")
    const solo = await import("@/app/api/engine/solo/generate/route")
    const soloResponse = await solo.POST(request({
      projectId: "project_1",
      sectionId: "section_1",
      contextRevision: "revision_1",
      model: "genos2",
      optionsExpiresAt: "2026-07-18T12:15:00.000Z",
      instrumentOptionId: "option_1",
      styleOptionId: "option_2",
      takeCount: 3,
      subjectId: "attacker",
      context: {},
      rawMidi: "private",
    }))
    expect(soloResponse.status).toBe(400)
    expect(soloGenerate).not.toHaveBeenCalled()

    const lyrics = await import("@/app/api/engine/lyrics/generate/route")
    const lyricsResponse = await lyrics.POST(request({
      projectId: "project_1",
      entitlement: { product: "lyrics", grantId: "attacker" },
      creative: { language: "en" },
      prosody: {
        phrases: [{
          phraseId: "phrase_1",
          sectionRole: "verse",
          syllables: 3,
          prominence: [],
          sustain: [],
        }],
      },
      project: { song: "unrelated" },
      rawMidi: "private",
    }))
    expect(lyricsResponse.status).toBe(400)
    expect(lyricGenerate).not.toHaveBeenCalled()
  })

  it("delegates validated safe requests and disables caching", async () => {
    getSessionUserId.mockResolvedValue("user_1")
    soloOptions.mockResolvedValue({
      expiresAt: "2026-07-18T12:15:00.000Z",
      instruments: [{ optionId: "option_1", label: "Sax" }],
      styles: [{ optionId: "option_2", label: "Jazz" }],
    })
    lyricFit.mockResolvedValue({
      recipeReferenceId: "recipe_1",
      renderReferenceId: "render_1",
      phrases: [{
        phraseId: "phrase_1",
        words: ["home"],
        syllables: ["home"],
        assignments: [{ noteId: "note_1", lyric: "home" }],
      }],
      renderedExport: "TVRoZAAAAAYAAAAAAeA=",
    })

    const optionsRoute = await import("@/app/api/engine/solo/options/route")
    const optionsResponse = await optionsRoute.POST(request({ projectId: "project_1" }))
    expect(optionsResponse.status).toBe(200)
    expect(optionsResponse.headers.get("cache-control")).toBe("no-store, private")
    expect(soloOptions).toHaveBeenCalledWith("user_1", { projectId: "project_1" })

    const fitRoute = await import("@/app/api/engine/lyrics/fit/route")
    const fitBody = {
      projectId: "project_1",
      contextRevision: "revision_1",
      operation: "fit",
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
      lines: [{ phraseId: "phrase_1", text: "home" }],
    }
    const fitResponse = await fitRoute.POST(request(fitBody))
    expect(fitResponse.status).toBe(200)
    expect(lyricFit).toHaveBeenCalledWith("user_1", fitBody)
  })
})
