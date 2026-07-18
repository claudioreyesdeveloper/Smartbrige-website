import { describe, expect, it, vi } from "vitest"
import {
  createJamProjectAdapter,
  createProductionCatalogAdapter,
  createProductionEngineClient,
  createProductionPlanDispatcher,
  createYamahaConnectionAdapter,
  displayAt,
} from "@/components/jam-player/production"
import type { JamSong } from "@/components/jam-player/types"
import type { JamCatalogClient as DomainCatalogClient } from "@/lib/jam/catalog"
import type { PreparedPerformancePlan } from "@/lib/jam/dispatch"
import type { ProjectSession } from "@/lib/projects/client"
import type { YamahaMidiSession } from "@/lib/yamaha"

const song: JamSong = {
  id: "factory_song:s1",
  title: "Factory Song",
  subtitle: "Factory",
  category: "Pop",
  tempo: 120,
  key: "C",
  timeSignature: [4, 4],
  accent: "#000",
  sections: [{
    id: "factory_clip:c1",
    label: "Verse 1",
    bars: 4,
    variation: "A",
    chords: [{ beat: 0, duration: 4, name: "C" }],
  }],
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

const preparedPlan: PreparedPerformancePlan = {
  planId: "plan_1",
  expiresAt: "2099-01-01T00:00:00.000Z",
  display: {
    tempoBpm: 120,
    key: "C",
    timeSignature: { numerator: 4, denominator: 4 },
    durationMs: 8000,
    sections: [{ id: "factory_clip:c1", name: "Verse 1", startBar: 0, barCount: 4 }],
    chords: [{ symbol: "C", startBar: 0, durationBars: 1 }],
  },
  dispatch: {
    fullSong: [{ atMs: 0, target: "port1", bytes: "+g==" }],
    sections: {
      "factory_clip:c1": [{ atMs: 0, target: "port1", bytes: "+g==" }],
    },
  },
}

describe("production Jam adapters", () => {
  it("posts strict public engine requests and returns the canonical plan", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/engine/jam/prepare")
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({
        projectId: "proj_1",
        model: "genos",
        song: {
          tempoBpm: 120,
          key: "C",
          sections: [{ name: "Verse 1", styleNumber: 42 }],
        },
      })
      expect(body).not.toHaveProperty("styleId")
      expect(body.song.sections[0].chords[0].durationBars).toBe(0.5)
      return response(preparedPlan)
    })
    const engine = createProductionEngineClient(fetchMock)
    await expect(
      engine.prepare({
        projectId: "proj_1",
        model: "genos",
        song: {
          ...song,
          sections: [{
            ...song.sections[0]!,
            chords: [{ beat: 0, duration: 2, name: "C" }],
          }],
        },
        key: "C",
        tempo: 120,
        styleId: "style:42",
        styleNumber: 42,
        loop: false,
      }),
    ).resolves.toEqual(preparedPlan)
  })

  it("preserves fractional reharmonization durations and section scope", async () => {
    const twoSectionSong: JamSong = {
      ...song,
      sections: [
        {
          ...song.sections[0]!,
          chords: [{ beat: 0, duration: 2, name: "C" }],
        },
        {
          id: "factory_clip:c2",
          label: "Chorus",
          bars: 4,
          variation: "B",
          chords: [{ beat: 0, duration: 2, name: "F" }],
        },
      ],
    }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.chords.map((chord: { durationBars: number }) => chord.durationBars)).toEqual([
        0.5,
        0.5,
      ])
      return response({
        generationId: "gen_1",
        candidates: [{
          id: "candidate_1",
          chords: [{ symbol: "G7", startBar: 0, durationBars: 0.5 }],
        }],
      })
    })
    const result = await createProductionEngineClient(fetchMock).reharmonize({
      projectId: "proj_1",
      model: "genos",
      song: twoSectionSong,
      key: "C",
      scope: "section",
      sectionId: "factory_clip:c2",
    })
    expect(result.candidates[0]!.chordsBySection).toEqual({
      "factory_clip:c2": [{ beat: 0, duration: 2, name: "G7" }],
    })
  })

  it("maps auth, quota, and network failures to safe UI errors", async () => {
    const auth = createProductionEngineClient(async () =>
      response({ code: "unauthenticated", error: "Authentication is required." }, 401),
    )
    await expect(
      auth.reharmonize({
        projectId: "proj_1",
        model: "genos",
        song,
        key: "C",
        scope: "song",
      }),
    ).rejects.toMatchObject({ code: "unauthorized" })

    const network = createProductionEngineClient(async () => {
      throw new Error("private detail")
    })
    await expect(
      network.reharmonize({
        projectId: "proj_1",
        model: "genos",
        song,
        key: "C",
        scope: "song",
      }),
    ).rejects.toMatchObject({ code: "network", message: "Could not reach the Jam service." })
  })

  it("maps paginated catalog stable ids, exact names/order, mains, and defaults", async () => {
    const domain = {
      ensureLoaded: vi.fn(async () => ({
        songs: [{ category: "" }, { category: "Pop" }],
      })),
      listSongs: vi.fn(async ({ page }: { page: number }) => ({
        items: page === 1 ? [{
          stableId: "factory_song:s1",
          title: "Factory Song",
          category: "",
          tempo: 0,
          key: "",
          timeSignature: [4, 4],
          sections: [],
        }] : [],
        hasMore: page === 1,
      })),
      getSong: vi.fn(async () => ({
        stableId: "factory_song:s1",
        title: "Factory Song",
        category: "Pop",
        tempo: 120,
        key: "C",
        timeSignature: [4, 4],
        sections: [
          {
            stableId: "factory_clip:b",
            name: "Chorus exact",
            bars: 4,
            order: 2,
            main: "D",
            chords: [{ symbol: "G7", startBar: 0, startBeat: 0, lengthBeats: 4 }],
          },
          {
            stableId: "factory_clip:a",
            name: "Verse exact",
            bars: 4,
            order: 1,
            main: "A",
            chords: [{ symbol: "C", startBar: 0, startBeat: 0, lengthBeats: 4 }],
          },
        ],
      })),
      listStyles: vi.fn(async () => ({
        items: [{ stableId: "style:1", name: "EasyPop", styleNumber: 1 }],
        hasMore: false,
      })),
    } as unknown as DomainCatalogClient
    const catalog = createProductionCatalogAdapter(domain)
    expect(await catalog.listCategories()).toEqual(["Pop", "Uncategorized"])
    expect((await catalog.listSongs())[0]).toMatchObject({
      id: "factory_song:s1",
      category: "Uncategorized",
      tempo: 120,
      key: "C",
    })
    const mapped = await catalog.getSong("factory_song:s1")
    expect(mapped.sections.map((section) => [section.id, section.label, section.variation])).toEqual([
      ["factory_clip:a", "Verse exact", "A"],
      ["factory_clip:b", "Chorus exact", "D"],
    ])
    expect((await catalog.listStyles({ model: "genos" }))[0]).toMatchObject({
      id: "style:1",
      category: "Other",
      bpm: 0,
    })
  })

  it("maps Yamaha state and removes the exact EventTarget listener", async () => {
    const target = new EventTarget()
    const session = Object.assign(target, {
      state: {
        supported: true,
        secure: true,
        connected: true,
        connecting: false,
        profile: { id: "genos", displayName: "Genos" },
        modelName: "Genos",
        outputName: "Yamaha Port 1",
        error: "",
      },
      requestAccess: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
    }) as unknown as YamahaMidiSession
    const remove = vi.spyOn(session, "removeEventListener")
    const connection = createYamahaConnectionAdapter(session)
    const listener = vi.fn()
    const unsubscribe = connection.subscribe(listener)
    await connection.connect("genos2")
    expect(session.requestAccess).toHaveBeenCalledWith("genos2")
    await connection.refresh()
    expect(session.requestAccess).toHaveBeenCalled()
    expect(connection.getState()).toMatchObject({ connected: true, model: "genos", secure: true })
    await connection.disconnect()
    expect(session.disconnect).toHaveBeenCalled()
    unsubscribe()
    expect(remove).toHaveBeenCalledWith("statechange", expect.any(Function))
  })

  it("delegates canonical validation and MIDI dispatch to the production dispatcher", () => {
    const sent: Uint8Array[] = []
    const target = Object.assign(new EventTarget(), {
      state: { connected: true },
      send: (bytes: Uint8Array) => sent.push(bytes),
      panic: vi.fn(),
    }) as unknown as YamahaMidiSession
    const dispatcher = createProductionPlanDispatcher(target)
    dispatcher.loadPlan(preparedPlan)
    dispatcher.play({ mode: "full" })
    expect([...sent[0]!]).toEqual([0xfa])
    expect(dispatcher.getState()).toMatchObject({
      status: "playing",
      currentSectionLabel: "Verse 1",
      currentChord: "C",
    })
    expect(() =>
      dispatcher.loadPlan({
        ...preparedPlan,
        dispatch: { ...preparedPlan.dispatch, fullSong: [{ atMs: 0, target: "port1", bytes: "-g==" }] },
      } as never),
    ).toThrow(/canonical standard base64/)
  })

  it("derives sections and chords using full bar duration", () => {
    const timelinePlan: PreparedPerformancePlan = {
      ...preparedPlan,
      display: {
        ...preparedPlan.display,
        durationMs: 4000,
        sections: [
          { id: "s1", name: "Verse", startBar: 0, barCount: 1 },
          { id: "s2", name: "Chorus", startBar: 1, barCount: 1 },
        ],
        chords: [
          { symbol: "C", startBar: 0, durationBars: 1 },
          { symbol: "F", startBar: 1, durationBars: 1 },
        ],
      },
    }
    const state = {
      status: "playing",
      generation: 1,
      planId: timelinePlan.planId,
      selection: { mode: "full" },
      positionMs: 1999,
      durationMs: 4000,
      scheduledCount: 2,
      sentCount: 1,
      expiresAt: timelinePlan.expiresAt,
      error: null,
    } as const
    expect(displayAt(timelinePlan, state)).toEqual({ section: "Verse", chord: "C" })
    expect(displayAt(timelinePlan, { ...state, positionMs: 2000 })).toEqual({
      section: "Chorus",
      chord: "F",
    })
  })

  it("persists Jam state through the ProjectSession document boundary", async () => {
    let snapshot = {
      saveState: "clean",
      lastError: null,
      projectId: "proj_1",
      title: "Factory Song",
      version: 1,
      document: null,
    } as ReturnType<ProjectSession["getSnapshot"]>
    const session = {
      getSnapshot: () => snapshot,
      list: vi.fn(async () => []),
      create: vi.fn(async () => undefined),
      open: vi.fn(async () => undefined),
      updateTitle: vi.fn(),
      updateDocument: vi.fn((document) => {
        snapshot = { ...snapshot, document }
      }),
      save: vi.fn(async () => true),
      subscribe: vi.fn(() => () => undefined),
    } as unknown as ProjectSession
    const projects = createJamProjectAdapter(session)
    await projects.save({
      id: "proj_1",
      title: "Factory Song",
      version: 1,
      songId: song.id,
      key: "C",
      tempo: 120,
      styleId: "style:42",
      model: "genos2",
      loop: true,
      generationId: "gen_1",
      candidateId: "cand_1",
      chordsBySection: { "factory_clip:c1": song.sections[0]!.chords },
      song,
    })
    expect(session.updateDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 1,
        jam: expect.objectContaining({
          factorySongStableId: song.id,
          styleStableId: "style:42",
          model: "genos2",
          loop: true,
          generationId: "gen_1",
          candidateId: "cand_1",
        }),
      }),
    )
  })
})
