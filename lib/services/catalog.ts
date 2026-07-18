export const SERVICE_KEYS = [
  "jam-player",
  "bass-drums",
  "solo-phrases",
  "lyrics",
  "genos-mixer",
  "style-maker",
] as const

export type ServiceKey = (typeof SERVICE_KEYS)[number]

export type ServiceAvailability = "active" | "future"

export type SharedServiceCatalogEntry = {
  key: ServiceKey
  name: string
  description: string
  availability: ServiceAvailability
  sortOrder: number
}

/** Top-level product tabs in the app shell (Jam Player nests the rest). */
export const PRIMARY_NAV_KEYS = ["jam-player", "genos-mixer"] as const satisfies readonly ServiceKey[]

/** Entitlement keys reached via Jam Player sub-tabs. */
export const JAM_CHILD_SERVICE_KEYS = [
  "bass-drums",
  "solo-phrases",
  "lyrics",
] as const satisfies readonly ServiceKey[]

export const SHARED_SERVICE_CATALOG: readonly SharedServiceCatalogEntry[] = [
  {
    key: "jam-player",
    name: "Jam Player",
    description: "Song charts, section playback, reharmonization, and project save.",
    availability: "active",
    sortOrder: 10,
  },
  {
    key: "bass-drums",
    name: "Bass & Drums",
    description: "Factory clip browsing, adaptation, audition, and apply-to-song.",
    availability: "active",
    sortOrder: 20,
  },
  {
    key: "solo-phrases",
    name: "Solo Phrases",
    description: "Deterministic solo generation, audition, and saved takes.",
    availability: "active",
    sortOrder: 30,
  },
  {
    key: "lyrics",
    name: "Lyrics",
    description: "Melody analysis, lyric generation, syllable fitting, and export.",
    availability: "active",
    sortOrder: 40,
  },
  {
    key: "genos-mixer",
    name: "Genos Mixer",
    description: "Live Style and Song mixer control with project state.",
    availability: "active",
    sortOrder: 50,
  },
  {
    key: "style-maker",
    name: "Style Maker",
    description: "Future Yamaha style authoring workflow.",
    availability: "future",
    sortOrder: 60,
  },
] as const

export function isServiceKey(value: string): value is ServiceKey {
  return (SERVICE_KEYS as readonly string[]).includes(value)
}

export function getSharedServiceCatalogEntry(key: ServiceKey): SharedServiceCatalogEntry {
  const entry = SHARED_SERVICE_CATALOG.find((service) => service.key === key)
  if (!entry) {
    throw new Error(`Unknown service key: ${key}`)
  }
  return entry
}

/** Full catalog order for entitlements / account rows. */
export function getServiceNavOrder(): ServiceKey[] {
  return [...SHARED_SERVICE_CATALOG]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((entry) => entry.key)
}

/** Top-level ServiceNav product tabs only. */
export function getPrimaryNavOrder(): ServiceKey[] {
  return [...PRIMARY_NAV_KEYS]
}

export function isPrimaryNavKey(key: ServiceKey): boolean {
  return (PRIMARY_NAV_KEYS as readonly ServiceKey[]).includes(key)
}

export function isJamChildServiceKey(key: ServiceKey): boolean {
  return (JAM_CHILD_SERVICE_KEYS as readonly ServiceKey[]).includes(key)
}
