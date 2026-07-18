import type { YamahaModelId } from "@/lib/yamaha/types"
import type { JAM_ARRANGER_MAINS } from "@/lib/jam/catalog/constants"

export type { YamahaModelId }

export type JamArrangerMain = (typeof JAM_ARRANGER_MAINS)[number]

/** Safe chord summary for A15 prepare / A19 display. */
export type JamChordSummary = {
  symbol: string
  /** Exact `section_label` from catalog chord data. */
  sectionLabel: string
  startBar: number
  startBeat: number
  lengthBeats: number
}

/** One factory section / clip, with exact source name and Main A–D assignment. */
export type JamSectionSummary = {
  /** Opaque factory_clip stable id. */
  stableId: string
  /** Exact clip name from catalog (source section name). */
  name: string
  bars: number
  order: number
  /** Main A–D from catalog `style_variation`. */
  main: JamArrangerMain
  hasAsset: boolean
  chords: JamChordSummary[]
}

/** Safe factory song summary — no filesystem paths or internal DB ids. */
export type JamSongSummary = {
  /** Opaque factory_song stable id. */
  stableId: string
  title: string
  category: string
  tempo: number
  key: string
  timeSignature: [number, number]
  description?: string
  sections: JamSectionSummary[]
}

/** Model-specific style row from keyboard_catalog. */
export type JamStyleSummary = {
  /** Opaque client-derived style id (not an importer filesystem path). */
  stableId: string
  model: YamahaModelId
  name: string
  styleNumber: number
  category?: string
  bpm?: number
  timeSignature?: string
}

/** Lazily authorized short-lived asset handle (A09 via A11). */
export type JamAuthorizedAsset = {
  stableId: string
  contentType: string
  byteSize: number
  filename: string
  contentDisposition: string
  url: string
  expiresAt: string
}

export type JamCatalogPage<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export type JamSongQuery = {
  search?: string
  category?: string
  page?: number
  pageSize?: number
}

export type JamStyleQuery = {
  search?: string
  category?: string
  page?: number
  pageSize?: number
}

export type JamCatalogSnapshot = {
  /** Content-tree fingerprint for cache invalidation (not a DB row id). */
  catalogRevision: string
  catalogExportVersion: number
  schemaVersion: number
  songs: JamSongSummary[]
  stylesByModel: Record<YamahaModelId, JamStyleSummary[]>
}

export type JamCatalogFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export type JamCatalogClientOptions = {
  fetch?: JamCatalogFetch
  baseUrl?: string
  /** Injected clock for asset expiry tests. */
  now?: () => number
  /** Override refresh skew (ms before expiry). */
  assetRefreshSkewMs?: number
}

export type JamCatalogClient = {
  /** Fetch and parse the entitlement-gated jam-player catalog. */
  load: () => Promise<JamCatalogSnapshot>
  /** Return the last loaded snapshot, loading first when needed. */
  ensureLoaded: () => Promise<JamCatalogSnapshot>
  listSongs: (query?: JamSongQuery) => Promise<JamCatalogPage<JamSongSummary>>
  getSong: (stableId: string) => Promise<JamSongSummary>
  listStyles: (
    model: YamahaModelId,
    query?: JamStyleQuery,
  ) => Promise<JamCatalogPage<JamStyleSummary>>
  getStyle: (stableId: string) => Promise<JamStyleSummary>
  /**
   * Lazily authorize a single factory clip asset. Never bulk-prefetches.
   * Refreshes automatically when the signed URL is expired or near expiry.
   */
  authorizeAsset: (
    stableId: string,
    options?: { forceRefresh?: boolean },
  ) => Promise<JamAuthorizedAsset>
  /** Drop cached catalog + asset authorizations. */
  clearCache: () => void
}
