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

export function createJamCatalogClient(
  options: JamCatalogClientOptions = {},
): JamCatalogClient {
  const fetchImpl: JamCatalogFetch = options.fetch ?? fetch
  const baseUrl = (options.baseUrl ?? "").replace(/\/$/, "")
  const now = options.now ?? (() => Date.now())
  const refreshSkewMs = options.assetRefreshSkewMs ?? JAM_ASSET_REFRESH_SKEW_MS

  let snapshot: JamCatalogSnapshot | null = null
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
    const body = await request(`/api/catalog/${JAM_CATALOG_SERVICE_KEY}`)
    snapshot = parseJamCatalogResponse(body)
    // Catalog reload invalidates prior signed URLs (version may have changed).
    assetCache.clear()
    return snapshot
  }

  async function ensureLoaded(): Promise<JamCatalogSnapshot> {
    if (snapshot) return snapshot
    return load()
  }

  async function listSongs(
    query: JamSongQuery = {},
  ): Promise<JamCatalogPage<JamSongSummary>> {
    const current = await ensureLoaded()
    const filtered = current.songs.filter((song) => {
      if (query.category && song.category !== query.category) return false
      const haystack = `${song.title} ${song.category} ${song.key} ${song.description ?? ""}`
      return matchesSearch(haystack, query.search)
    })
    return paginateItems(filtered, query)
  }

  async function getSong(stableId: string): Promise<JamSongSummary> {
    if (!stableId) {
      throw new JamCatalogError("validation", "stableId is required.")
    }
    const current = await ensureLoaded()
    const song = current.songs.find((item) => item.stableId === stableId)
    if (!song) {
      throw new JamCatalogError("not_found", `Song was not found: ${stableId}`)
    }
    return song
  }

  async function listStyles(
    model: YamahaModelId,
    query: JamStyleQuery = {},
  ): Promise<JamCatalogPage<JamStyleSummary>> {
    if (!isSupportedYamahaModel(model)) {
      throw new JamCatalogError("unsupported_model", `Unsupported keyboard model: ${model}.`)
    }
    const current = await ensureLoaded()
    const styles = current.stylesByModel[model] ?? []
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
    const current = await ensureLoaded()
    for (const model of Object.keys(current.stylesByModel) as YamahaModelId[]) {
      const style = current.stylesByModel[model].find((item) => item.stableId === stableId)
      if (style) return style
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
    // Ensure the clip exists in the loaded catalog and is asset-bearing.
    const current = await ensureLoaded()
    let section: { stableId: string; hasAsset: boolean } | undefined
    for (const song of current.songs) {
      const found = song.sections.find((item) => item.stableId === stableId)
      if (found) {
        section = found
        break
      }
    }
    if (!section) {
      throw new JamCatalogError("not_found", `Catalog asset entry was not found: ${stableId}`)
    }
    if (!section.hasAsset) {
      throw new JamCatalogError("not_found", `Catalog entry has no asset: ${stableId}`)
    }

    const cached = assetCache.get(stableId)
    if (cached && !options?.forceRefresh && isAssetFresh(cached)) {
      return cached
    }

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
      snapshot = null
      assetCache.clear()
    },
  }
}
