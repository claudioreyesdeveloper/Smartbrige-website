import { describe, expect, it, vi } from "vitest"
import {
  createJamCatalogClient,
  JAM_CATALOG_MAX_PAGE_SIZE,
  JamCatalogError,
  parseJamCatalogResponse,
  styleStableId,
  type JamCatalogFetch,
} from "@/lib/jam/catalog"

const CATALOG_REVISION = "a".repeat(64)

function songEntry(overrides?: {
  stableId?: string
  name?: string
  category?: string
  bpm?: number
  key?: string
  ts_num?: number
  ts_den?: number
  description?: string
}) {
  return {
    stableId: overrides?.stableId ?? "factory_song:song-1",
    section: "factory_songs",
    kind: "factory_song",
    hasAsset: false,
    blobReferenceId: null,
    metadata: {
      stable_id: overrides?.stableId ?? "factory_song:song-1",
      song: {
        id: "song-1",
        name: overrides?.name ?? "Factory Song",
        category: overrides?.category ?? "Pop",
        bpm: overrides?.bpm ?? 120,
        key: overrides?.key ?? "C",
        description: overrides?.description ?? "factory",
        ts_num: overrides?.ts_num ?? 4,
        ts_den: overrides?.ts_den ?? 4,
      },
      source: {
        library: "Pop",
        path: null,
        source_file: null,
        license: null,
        license_status: "UNKNOWN",
      },
      clip_count: 1,
      chord_block_count: 1,
    },
  }
}

function clipEntry(overrides?: {
  stableId?: string
  songStableId?: string
  name?: string
  style_variation?: string
  bars?: number
  clip_order?: number
  hasAsset?: boolean
  blobReferenceId?: string | null
}) {
  const stableId = overrides?.stableId ?? "factory_clip:1"
  return {
    stableId,
    section: "factory_songs",
    kind: "factory_clip",
    hasAsset: overrides?.hasAsset ?? true,
    blobReferenceId: overrides?.blobReferenceId ?? "blob-clip-1",
    metadata: {
      stable_id: stableId,
      song_stable_id: overrides?.songStableId ?? "factory_song:song-1",
      variation_count: 0,
      clip: {
        id: 1,
        song_id: "song-1",
        name: overrides?.name ?? "Verse 1",
        bars: overrides?.bars ?? 4,
        clip_order: overrides?.clip_order ?? 0,
        style_variation: overrides?.style_variation ?? "A",
        notes: null,
        created_at: 0,
        updated_at: 0,
      },
      asset: {
        sha256: "b".repeat(64),
        size_bytes: 9,
        blobReferenceId: "blob-clip-1",
      },
    },
  }
}

function chordEntry(overrides?: {
  stableId?: string
  songStableId?: string
  section_label?: string
  chord_name?: string
  start_bar?: number
  start_beat?: number
  length_beats?: number
}) {
  const stableId = overrides?.stableId ?? "factory_chord_block:block-1"
  return {
    stableId,
    section: "factory_songs",
    kind: "factory_chord_block",
    hasAsset: false,
    blobReferenceId: null,
    metadata: {
      stable_id: stableId,
      song_stable_id: overrides?.songStableId ?? "factory_song:song-1",
      block: {
        id: "block-1",
        song_id: "song-1",
        section_label: overrides?.section_label ?? "Verse 1",
        chord_name: overrides?.chord_name ?? "Cmaj7",
        start_bar: overrides?.start_bar ?? 1,
        start_beat: overrides?.start_beat ?? 0.5,
        length_beats: overrides?.length_beats ?? 3.5,
        root: 0,
        quality: "maj7",
        confidence: 0.9,
        is_user_override: 0,
        analysis_version: 1,
        clip_id: -1,
        created_at: 0,
        updated_at: 0,
      },
    },
  }
}

function keyboardEntry(overrides?: {
  model_key?: string
  display_name?: string
  styles?: Array<Record<string, unknown>>
  source_file?: string
}) {
  return {
    stableId: "keyboard_model:1",
    section: "keyboard_catalog",
    kind: "keyboard_model",
    hasAsset: false,
    blobReferenceId: null,
    metadata: {
      stable_id: "keyboard_model:1",
      model: {
        id: 1,
        model_key: overrides?.model_key ?? "tyros5",
        display_name: overrides?.display_name ?? "Tyros 5",
      },
      source: {
        library: null,
        path: null,
        source_file: overrides?.source_file ?? "Tyros5.dat",
        license: null,
        license_status: "UNKNOWN",
      },
      styles: overrides?.styles ?? [
        { id: 1, name: "8 Beat Basic", style_number: 1, category: "Pop", bpm: 120 },
        { id: 2, name: "Cool Jazz", style_number: 42, category: "Jazz", bpm: 110 },
      ],
      voices: [{ id: 1, name: "Grand Piano" }],
      multipads: [{ id: 1, name: "Pad 1" }],
    },
  }
}

function catalogPayload(entries: unknown[]) {
  return {
    serviceKey: "jam-player",
    catalogVersionId: "internal-version-uuid-do-not-leak",
    contentTreeSha256: CATALOG_REVISION,
    catalogExportVersion: 1,
    schemaVersion: 1,
    entries,
  }
}

function keyboardModelEntry(
  stableId: string,
  options: {
    model_key: string
    display_name: string
    styles: Array<Record<string, unknown>>
    source_file?: string
  },
) {
  const base = keyboardEntry(options)
  return {
    ...base,
    stableId,
    metadata: {
      ...base.metadata,
      stable_id: stableId,
    },
  }
}

function defaultEntries() {
  return [
    songEntry(),
    clipEntry(),
    chordEntry(),
    songEntry({
      stableId: "factory_song:song-2",
      name: "Ballad Night",
      category: "Ballad",
      bpm: 72,
      key: "F",
      description: "slow evening",
    }),
    clipEntry({
      stableId: "factory_clip:2",
      songStableId: "factory_song:song-2",
      name: "Chorus",
      style_variation: "B",
      clip_order: 0,
      hasAsset: true,
      blobReferenceId: "blob-clip-2",
    }),
    chordEntry({
      stableId: "factory_chord_block:block-2",
      songStableId: "factory_song:song-2",
      section_label: "Chorus",
      chord_name: "F",
    }),
    keyboardModelEntry("keyboard_model:tyros5", {
      model_key: "tyros5",
      display_name: "Tyros 5",
      styles: [
        { id: 1, name: "8 Beat Basic", style_number: 1, category: "Pop", bpm: 120 },
        { id: 2, name: "Cool Jazz", style_number: 42, category: "Jazz", bpm: 110 },
      ],
      source_file: "Tyros5.dat",
    }),
    keyboardModelEntry("keyboard_model:genos2", {
      model_key: "genos2",
      display_name: "Genos2",
      styles: [{ id: 9, name: "EasyPop", style_number: 100, category: "Pop", bpm: 100 }],
      source_file: "GENOS 2.dat",
    }),
  ]
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function createFetchMock(handlers: {
  catalog?: (url: string) => Response | Promise<Response>
  asset?: (url: string, stableId: string) => Response | Promise<Response>
}) {
  const calls: string[] = []
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.includes("/assets/")) {
      const encoded = url.split("/assets/")[1] ?? ""
      const stableId = decodeURIComponent(encoded)
      if (handlers.asset) return handlers.asset(url, stableId)
      throw new Error(`Unhandled asset ${url}`)
    }
    if (url.endsWith("/api/catalog/jam-player") || url.includes("/api/catalog/jam-player?")) {
      if (handlers.catalog) return handlers.catalog(url)
      return jsonResponse(200, catalogPayload(defaultEntries()))
    }
    throw new Error(`Unhandled fetch ${url}`)
  }) as unknown as JamCatalogFetch
  return { fetchImpl, calls }
}

describe("parseJamCatalogResponse", () => {
  it("preserves exact section names, chords, tempo, key, time signature, and Main A–D", () => {
    const snapshot = parseJamCatalogResponse(
      catalogPayload([
        songEntry({ name: "Factory Song", bpm: 118, key: "Bb", ts_num: 3, ts_den: 4 }),
        clipEntry({ name: "Bridge*", style_variation: "C", bars: 8, clip_order: 2 }),
        chordEntry({
          section_label: "Bridge*",
          chord_name: "Eb/G",
          start_bar: 2,
          start_beat: 1.5,
          length_beats: 2,
        }),
        keyboardEntry({ model_key: "tyros5" }),
      ]),
    )

    expect(snapshot.songs).toHaveLength(1)
    const song = snapshot.songs[0]!
    expect(song.title).toBe("Factory Song")
    expect(song.tempo).toBe(118)
    expect(song.key).toBe("Bb")
    expect(song.timeSignature).toEqual([3, 4])
    expect(song.sections).toHaveLength(1)
    expect(song.sections[0]).toMatchObject({
      name: "Bridge*",
      main: "C",
      bars: 8,
      order: 2,
      hasAsset: true,
    })
    expect(song.sections[0]!.chords).toEqual([
      {
        symbol: "Eb/G",
        sectionLabel: "Bridge*",
        startBar: 2,
        startBeat: 1.5,
        lengthBeats: 2,
      },
    ])
  })

  it("matches chords by Main letter when section_label uses style_variation", () => {
    const snapshot = parseJamCatalogResponse(
      catalogPayload([
        songEntry(),
        clipEntry({ name: "intro", style_variation: "A" }),
        chordEntry({ section_label: "A", chord_name: "C" }),
        keyboardEntry(),
      ]),
    )
    expect(snapshot.songs[0]!.sections[0]!.chords[0]).toMatchObject({
      symbol: "C",
      sectionLabel: "A",
    })
  })

  it("does not expose internal catalog ids, blob ids, or filesystem source fields", () => {
    const snapshot = parseJamCatalogResponse(catalogPayload(defaultEntries()))
    const serialized = JSON.stringify(snapshot)
    expect(serialized).not.toContain("internal-version-uuid-do-not-leak")
    expect(serialized).not.toContain("blob-clip-1")
    expect(serialized).not.toContain("blobReferenceId")
    expect(serialized).not.toContain("catalogVersionId")
    expect(serialized).not.toContain("Tyros5.dat")
    expect(serialized).not.toContain("source_file")
    expect(serialized).not.toContain("song_id")
    expect(serialized).not.toContain('"id":"song-1"')
    expect(serialized).not.toContain("Grand Piano")
    expect(snapshot.catalogRevision).toBe(CATALOG_REVISION)
    expect(snapshot.stylesByModel.tyros5[0]!.stableId).toBe(styleStableId("tyros5", 1))
  })

  it("fails closed on unknown schema versions", () => {
    expect(() =>
      parseJamCatalogResponse({
        ...catalogPayload(defaultEntries()),
        schemaVersion: 99,
      }),
    ).toThrow(JamCatalogError)
    try {
      parseJamCatalogResponse({
        ...catalogPayload(defaultEntries()),
        catalogExportVersion: 2,
      })
    } catch (error) {
      expect(error).toBeInstanceOf(JamCatalogError)
      expect((error as JamCatalogError).code).toBe("unsupported_schema")
    }
  })

  it("skips unsupported keyboard models without failing the catalog", () => {
    const snapshot = parseJamCatalogResponse(
      catalogPayload([songEntry(), clipEntry(), chordEntry(), keyboardEntry({ model_key: "psr-sx900" })]),
    )
    expect(snapshot.songs).toHaveLength(1)
    expect(snapshot.stylesByModel.genos).toEqual([])
    expect(snapshot.stylesByModel.genos2).toEqual([])
  })

  it("skips invalid style_number rows without failing the catalog", () => {
    const keyboard = keyboardEntry({ model_key: "genos1" })
    const styles = (keyboard.metadata as { styles: Array<Record<string, unknown>> }).styles
    styles.push({
      ...styles[0],
      id: 99999,
      name: "BrokenZero",
      style_number: 0,
    })
    const snapshot = parseJamCatalogResponse(
      catalogPayload([songEntry(), clipEntry(), chordEntry(), keyboard]),
    )
    expect(snapshot.songs).toHaveLength(1)
    expect(snapshot.stylesByModel.genos.every((style) => style.styleNumber >= 1)).toBe(true)
    expect(snapshot.stylesByModel.genos.some((style) => style.name === "BrokenZero")).toBe(false)
  })

  it("rejects tampered filesystem path leakage in metadata", () => {
    const entry = songEntry()
    ;(entry.metadata as { source: { path: string | null } }).source.path =
      "/Users/secret/factory.mid"
    expect(() => parseJamCatalogResponse(catalogPayload([entry, clipEntry(), chordEntry()]))).toThrow(
      /filesystem/,
    )
  })

  it("rejects unknown factory kinds (fail closed)", () => {
    expect(() =>
      parseJamCatalogResponse(
        catalogPayload([
          songEntry(),
          {
            stableId: "factory_mystery:1",
            section: "factory_songs",
            kind: "factory_mystery",
            hasAsset: false,
            metadata: {},
          },
        ]),
      ),
    ).toThrow(/Unknown factory_songs kind/)
  })

  it("verifies response entry limits", () => {
    const entries = Array.from({ length: 8001 }, (_, index) =>
      songEntry({ stableId: `factory_song:s-${index}`, name: `Song ${index}` }),
    )
    expect(() => parseJamCatalogResponse(catalogPayload(entries))).toThrow(/entries exceed limit/)
  })
})

describe("createJamCatalogClient", () => {
  it("maps entitlement denial to forbidden/unauthenticated", async () => {
    const forbidden = createFetchMock({
      catalog: () =>
        jsonResponse(403, { error: "Service entitlement required: jam-player", code: "forbidden" }),
    })
    const client403 = createJamCatalogClient({ fetch: forbidden.fetchImpl })
    await expect(client403.load()).rejects.toMatchObject({
      code: "forbidden",
      status: 403,
    })

    const unauth = createFetchMock({
      catalog: () =>
        jsonResponse(401, { error: "Authentication is required.", code: "unauthenticated" }),
    })
    const client401 = createJamCatalogClient({ fetch: unauth.fetchImpl })
    await expect(client401.load()).rejects.toMatchObject({
      code: "unauthenticated",
      status: 401,
    })
  })

  it("supports pagination, filter, and search without refetching the catalog", async () => {
    const { fetchImpl, calls } = createFetchMock({})
    const client = createJamCatalogClient({ fetch: fetchImpl })

    const page1 = await client.listSongs({ page: 1, pageSize: 1 })
    expect(page1.items).toHaveLength(1)
    expect(page1.total).toBe(2)
    expect(page1.hasMore).toBe(true)

    const ballads = await client.listSongs({ category: "Ballad" })
    expect(ballads.items.map((song) => song.title)).toEqual(["Ballad Night"])

    const search = await client.listSongs({ search: "factory" })
    expect(search.items.map((song) => song.title)).toEqual(["Factory Song"])

    expect(calls.filter((url) => url.includes("/api/catalog/jam-player")).length).toBe(1)

    await expect(
      client.listSongs({ pageSize: JAM_CATALOG_MAX_PAGE_SIZE + 1 }),
    ).rejects.toMatchObject({ code: "limit_exceeded" })
  })

  it("lists model-specific styles for Genos/Genos2/Tyros4/Tyros5", async () => {
    const entries = [
      songEntry(),
      clipEntry(),
      chordEntry(),
      keyboardModelEntry("keyboard_model:tyros5", {
        model_key: "tyros5",
        display_name: "Tyros 5",
        styles: [{ id: 1, name: "8 Beat Basic", style_number: 1, category: "Pop" }],
      }),
      keyboardModelEntry("keyboard_model:genos", {
        model_key: "genos",
        display_name: "Genos",
        styles: [{ id: 1, name: "Genos Pop", style_number: 10, category: "Pop" }],
      }),
      keyboardModelEntry("keyboard_model:genos2", {
        model_key: "genos2",
        display_name: "Genos2",
        styles: [{ id: 1, name: "Genos2 Pop", style_number: 11, category: "Pop" }],
      }),
      keyboardModelEntry("keyboard_model:tyros4", {
        model_key: "tyros4",
        display_name: "Tyros4",
        styles: [{ id: 1, name: "Tyros4 Pop", style_number: 12, category: "Pop" }],
      }),
    ]
    const { fetchImpl } = createFetchMock({
      catalog: () => jsonResponse(200, catalogPayload(entries)),
    })
    const client = createJamCatalogClient({ fetch: fetchImpl })

    expect((await client.listStyles("tyros5")).items.map((s) => s.name)).toContain("8 Beat Basic")
    expect((await client.listStyles("genos")).items.map((s) => s.name)).toEqual(["Genos Pop"])
    expect((await client.listStyles("genos2")).items.map((s) => s.name)).toEqual(["Genos2 Pop"])
    expect((await client.listStyles("tyros4")).items.map((s) => s.name)).toEqual(["Tyros4 Pop"])
    await expect(client.listStyles("psr" as never)).rejects.toMatchObject({
      code: "unsupported_model",
    })
  })

  it("refreshes expired asset URLs and never bulk-prefetches assets", async () => {
    let nowMs = Date.parse("2026-07-18T12:00:00.000Z")
    let assetCalls = 0
    const { fetchImpl, calls } = createFetchMock({
      asset: (_url, stableId) => {
        assetCalls += 1
        const expiresAt = new Date(nowMs + (assetCalls === 1 ? 10_000 : 120_000)).toISOString()
        return jsonResponse(200, {
          blobReferenceId: "blob-clip-1",
          contentType: "audio/midi",
          byteSize: 9,
          filename: "factory_clip_1.mid",
          contentDisposition: 'attachment; filename="factory_clip_1.mid"',
          presignedUrl: `https://blob.example/signed/${stableId}?n=${assetCalls}`,
          expiresAt,
        })
      },
    })

    const client = createJamCatalogClient({
      fetch: fetchImpl,
      now: () => nowMs,
      assetRefreshSkewMs: 30_000,
    })

    await client.load()
    expect(calls.some((url) => url.includes("/assets/"))).toBe(false)

    const songs = await client.listSongs()
    expect(calls.filter((url) => url.includes("/assets/"))).toHaveLength(0)
    expect(songs.items.every((song) => song.sections.some((section) => section.hasAsset))).toBe(
      true,
    )

    const first = await client.authorizeAsset("factory_clip:1")
    expect(first.url).toContain("n=1")
    expect(assetCalls).toBe(1)
    expect(JSON.stringify(first)).not.toContain("blobReferenceId")
    expect(JSON.stringify(first)).not.toContain("blob-clip-1")

    // Still within skew of expiry → refresh.
    const refreshed = await client.authorizeAsset("factory_clip:1")
    expect(assetCalls).toBe(2)
    expect(refreshed.url).toContain("n=2")

    // Fresh URL reused without another network call.
    const reused = await client.authorizeAsset("factory_clip:1")
    expect(assetCalls).toBe(2)
    expect(reused.url).toBe(refreshed.url)

    // Advance past expiry → refresh again.
    nowMs += 200_000
    const afterExpiry = await client.authorizeAsset("factory_clip:1")
    expect(assetCalls).toBe(3)
    expect(afterExpiry.url).toContain("n=3")

    // Listing never authorizes every clip.
    expect(calls.filter((url) => url.includes("/assets/")).length).toBe(3)
  })

  it("rejects authorizeAsset for unknown or asset-less clips", async () => {
    const { fetchImpl } = createFetchMock({
      catalog: () =>
        jsonResponse(
          200,
          catalogPayload([
            songEntry(),
            clipEntry({ hasAsset: false, blobReferenceId: null }),
            chordEntry(),
            keyboardEntry(),
          ]),
        ),
    })
    const client = createJamCatalogClient({ fetch: fetchImpl })
    await expect(client.authorizeAsset("factory_clip:missing")).rejects.toMatchObject({
      code: "not_found",
    })
    await expect(client.authorizeAsset("factory_clip:1")).rejects.toMatchObject({
      code: "not_found",
      message: expect.stringContaining("has no asset"),
    })
  })
})
