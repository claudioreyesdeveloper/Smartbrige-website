/** Matches A06/A11 factory catalog schema versions accepted by this client. */
export const JAM_CATALOG_EXPORT_VERSION = 1
export const JAM_CATALOG_SCHEMA_VERSION = 1

export const JAM_CATALOG_SERVICE_KEY = "jam-player" as const

/** Hard caps verified against the list payload before parsing. */
export const JAM_CATALOG_MAX_ENTRIES = 8_000
export const JAM_CATALOG_MAX_SONGS = 2_000
export const JAM_CATALOG_MAX_SECTIONS_PER_SONG = 64
export const JAM_CATALOG_MAX_CHORDS_PER_SECTION = 256
export const JAM_CATALOG_MAX_STYLES_PER_MODEL = 2_000
export const JAM_CATALOG_MAX_PAGE_SIZE = 100
export const JAM_CATALOG_DEFAULT_PAGE_SIZE = 25

/** Refresh signed asset URLs this many ms before expiry. */
export const JAM_ASSET_REFRESH_SKEW_MS = 30_000

export const JAM_SUPPORTED_MODELS = ["genos", "genos2", "tyros4", "tyros5"] as const

export const JAM_ARRANGER_MAINS = ["A", "B", "C", "D"] as const
