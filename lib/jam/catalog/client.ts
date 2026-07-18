import {
  JAM_ASSET_REFRESH_SKEW_MS,
  JAM_CATALOG_SERVICE_KEY,
} from "@/lib/jam/catalog/constants"
import { JamCatalogError } from "@/lib/jam/catalog/errors"
import {
  isSupportedYamahaModel,
  parseAuthorizedAssetResponse,
  parseJamCatalogResponse,
} from "@/lib/jam/catalog/parse"
import { matchesSearch, paginateItems } from "@/lib/jam/catalog/query"
import type {
  JamAuthorizedAsset,
  JamCatalogClient,
  JamCatalogClientOptions,
  JamCatalogFetch,
  JamCatalogPage,
  JamCatalogSnapshot,
  JamSongQuery,
  JamSongSummary,
  JamStyleQuery,
  JamStyleSummary,
  YamahaModelId,
} from "@/lib/jam/catalog/types"

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new JamCatalogError(
      "malformed",
      "API response is not valid JSON.",
      response.status,
    )
  }
}

function mapHttpError(status: number, body: unknown): JamCatalogError {
  const message =
    isPlainObject(body) && typeof body.error === "string"
      ? body.error
      : `Request failed with status ${status}.`
  switch (status) {
    case 401:
      return new JamCatalogError("unauthenticated", message, status)
    case 403:
      return new JamCatalogError("forbidden", message, status)
    case 404:
      return new JamCatalogError("not_found", message, status)
    case 400:
      return new JamCatalogError("validation", message, status)
    default:
      return new JamCatalogError("internal", message, status)
  }
}

function emptyStylesByModel(): Record<YamahaModelId, JamStyleSummary[]> {
  return {
    genos: [],
    genos2: [],
    tyros4: [],
    tyros5: [],
  }
}

export function createJamCatalogClient(
  options: JamCatalogClientOptions = {},
): JamCatalogClient {
  const fetchImpl: JamCatalogFetch = options.fetch ?? fetch
  const baseUrl = (options.baseUrl ?? "").replace(/\/$/, "")
  const now = options.now ?? (() => Date.now())
  const refreshSkewMs = options.assetRefreshSkewMs ?? JAM_ASSET_REFRESH_SKEW_MS

  /** Song index only (factory_song rows) — ~30KB, enough for Search. */
  let songIndex: JamCatalogSnapshot | null = null
  let songIndexPromise: Promise<JamCatalogSnapshot> | null = null
  /** Full dump — kept for tests / load(); not used by browse UI. */
  let fullSnapshot: JamCatalogSnapshot | null = null
  let fullPromise: Promise<JamCatalogSnapshot> | null = null
  const songDetails = new Map<string, JamSongSummary>()
  const songDetailPromises = new Map<string, Promise<JamSongSummary>>()
  const stylesByModel = emptyStylesByModel()
  const stylePromises = new Map<YamahaModelId, Promise<JamStyleSummary[]>>()
  const assetCache = new Map<string, JamAuthorizedAsset>()

  async function request(path: string): Promise<unknown> {
    let response: Response
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      })
    } catch {
      throw new JamCatalogError("network", "Network request failed.")
    }
    const body = await readBody(response)
    if (!response.ok) {
      throw mapHttpError(response.status, body)
    }
    return body
  }

  async function load(): Promise<JamCatalogSnapshot> {
    if (fullSnapshot) return fullSnapshot
    if (!fullPromise) {
      fullPromise = (async () => {
        const body = await request(`/api/catalog/${JAM_CATALOG_SERVICE_KEY}`)
        fullSnapshot = parseJamCatalogResponse(body)
        songIndex = {
          ...fullSnapshot,
          songs: fullSnapshot.songs.map((song) => ({
            ...song,
            sections: [],
            reharmonizations: [],
            sectionCount: song.sectionCount || song.sections.length,
          })),
        }
        for (const song of fullSnapshot.songs) {
          songDetails.set(song.stableId, song)
        }
        for (const model of Object.keys(fullSnapshot.stylesByModel) as YamahaModelId[]) {
          stylesByModel[model] = fullSnapshot.stylesByModel[model]
        }
        assetCache.clear()
        return fullSnapshot
      })().finally(() => {
        fullPromise = null
      })
    }
    return fullPromise
  }

  async function ensureSongIndex(): Promise<JamCatalogSnapshot> {
    if (songIndex) return songIndex
    if (fullSnapshot) {
      songIndex = {
        ...fullSnapshot,
        songs: fullSnapshot.songs.map((song) => ({
          ...song,
          sections: [],
          reharmonizations: [],
          sectionCount: song.sectionCount || song.sections.length,
        })),
      }
      return songIndex
    }
    if (!songIndexPromise) {
      songIndexPromise = (async () => {
        const body = await request(
          `/api/catalog/${JAM_CATALOG_SERVICE_KEY}?kinds=factory_song`,
        )
        const parsed = parseJamCatalogResponse(body)
        songIndex = parsed
        return parsed
      })().finally(() => {
        songIndexPromise = null
      })
    }
    return songIndexPromise
  }

  async function ensureLoaded(): Promise<JamCatalogSnapshot> {
    // Browse callers should use the song index; keep full load available for tests.
    if (fullSnapshot) return fullSnapshot
    return ensureSongIndex()
  }

  async function ensureStyles(model: YamahaModelId): Promise<JamStyleSummary[]> {
    if (stylesByModel[model].length > 0) return stylesByModel[model]
    if (fullSnapshot) {
      stylesByModel[model] = fullSnapshot.stylesByModel[model] ?? []
      return stylesByModel[model]
    }
    const pending = stylePromises.get(model)
    if (pending) return pending

    const promise = (async () => {
      const body = await request(
        `/api/catalog/${JAM_CATALOG_SERVICE_KEY}?kinds=keyboard_model&modelKey=${encodeURIComponent(model)}&slimStyles=1`,
      )
      const parsed = parseJamCatalogResponse(body)
      stylesByModel[model] = parsed.stylesByModel[model] ?? []
      return stylesByModel[model]
    })().finally(() => {
      stylePromises.delete(model)
    })
    stylePromises.set(model, promise)
    return promise
  }

  async function listSongs(
    query: JamSongQuery = {},
  ): Promise<JamCatalogPage<JamSongSummary>> {
    const current = await ensureSongIndex()
    const filtered = current.songs.filter((song) => {
      if (query.category && song.category !== query.category) return false
      const tonality = query.keyTonality ?? "any"
      if (tonality !== "any") {
        const isMinor = song.key.trim().toLowerCase().endsWith("m")
        if (tonality === "major" && isMinor) return false
        if (tonality === "minor" && !isMinor) return false
      }
      const band = query.tempoBand ?? "any"
      if (band === "slow" && !(song.tempo < 90)) return false
      if (band === "medium" && !(song.tempo >= 90 && song.tempo <= 130)) return false
      if (band === "fast" && !(song.tempo > 130)) return false
      const meter = query.timeSignature?.trim()
      if (meter) {
        const songMeter = `${song.timeSignature[0]}/${song.timeSignature[1]}`
        if (songMeter !== meter) return false
      }
      const haystack = `${song.title} ${song.category} ${song.key} ${song.description ?? ""}`
      return matchesSearch(haystack, query.search)
    })
    return paginateItems(filtered, query)
  }

  async function getSong(stableId: string): Promise<JamSongSummary> {
    if (!stableId) {
      throw new JamCatalogError("validation", "stableId is required.")
    }
    const cached = songDetails.get(stableId)
    if (cached && cached.sections.length > 0) return cached
    if (fullSnapshot) {
      const song = fullSnapshot.songs.find((item) => item.stableId === stableId)
      if (!song) {
        throw new JamCatalogError("not_found", `Song was not found: ${stableId}`)
      }
      songDetails.set(stableId, song)
      return song
    }

    const pending = songDetailPromises.get(stableId)
    if (pending) return pending

    const promise = (async () => {
      const body = await request(
        `/api/catalog/${JAM_CATALOG_SERVICE_KEY}?songStableId=${encodeURIComponent(stableId)}&kinds=factory_song,factory_clip,factory_chord_block,factory_clip_variation`,
      )
      const parsed = parseJamCatalogResponse(body)
      const song = parsed.songs.find((item) => item.stableId === stableId)
      if (!song || song.sections.length === 0) {
        throw new JamCatalogError("not_found", `Song was not found: ${stableId}`)
      }
      songDetails.set(stableId, song)
      return song
    })().finally(() => {
      songDetailPromises.delete(stableId)
    })
    songDetailPromises.set(stableId, promise)
    return promise
  }

  async function listStyles(
    model: YamahaModelId,
    query: JamStyleQuery = {},
  ): Promise<JamCatalogPage<JamStyleSummary>> {
    if (!isSupportedYamahaModel(model)) {
      throw new JamCatalogError("unsupported_model", `Unsupported keyboard model: ${model}.`)
    }
    const styles = await ensureStyles(model)
    const filtered = styles.filter((style) => {
      if (query.category && style.category !== query.category) return false
      const haystack = `${style.name} ${style.category ?? ""} ${style.styleNumber}`
      return matchesSearch(haystack, query.search)
    })
    return paginateItems(filtered, query)
  }

  async function getStyle(stableId: string): Promise<JamStyleSummary> {
    if (!stableId) {
      throw new JamCatalogError("validation", "stableId is required.")
    }
    for (const model of Object.keys(stylesByModel) as YamahaModelId[]) {
      if (stylesByModel[model].length === 0) {
        await ensureStyles(model)
      }
      const style = stylesByModel[model].find((item) => item.stableId === stableId)
      if (style) return style
    }
    if (fullSnapshot) {
      for (const model of Object.keys(fullSnapshot.stylesByModel) as YamahaModelId[]) {
        const style = fullSnapshot.stylesByModel[model].find(
          (item) => item.stableId === stableId,
        )
        if (style) return style
      }
    }
    throw new JamCatalogError("not_found", `Style was not found: ${stableId}`)
  }

  function isAssetFresh(asset: JamAuthorizedAsset): boolean {
    const expiresAt = Date.parse(asset.expiresAt)
    if (!Number.isFinite(expiresAt)) return false
    return expiresAt - now() > refreshSkewMs
  }

  async function authorizeAsset(
    stableId: string,
    options?: { forceRefresh?: boolean },
  ): Promise<JamAuthorizedAsset> {
    if (!stableId) {
      throw new JamCatalogError("validation", "stableId is required.")
    }

    const cached = assetCache.get(stableId)
    if (cached && !options?.forceRefresh && isAssetFresh(cached)) {
      return cached
    }

    // Server validates entitlement + asset existence; avoid downloading the full catalog.
    const encoded = encodeURIComponent(stableId)
    const body = await request(
      `/api/catalog/${JAM_CATALOG_SERVICE_KEY}/assets/${encoded}`,
    )
    const parsed = parseAuthorizedAssetResponse(body)
    const authorized: JamAuthorizedAsset = {
      stableId,
      ...parsed,
    }
    assetCache.set(stableId, authorized)
    return authorized
  }

  return {
    load,
    ensureLoaded,
    listSongs,
    getSong,
    listStyles,
    getStyle,
    authorizeAsset,
    clearCache: () => {
      songIndex = null
      songIndexPromise = null
      fullSnapshot = null
      fullPromise = null
      songDetails.clear()
      songDetailPromises.clear()
      for (const model of Object.keys(stylesByModel) as YamahaModelId[]) {
        stylesByModel[model] = []
      }
      stylePromises.clear()
      assetCache.clear()
    },
  }
}
