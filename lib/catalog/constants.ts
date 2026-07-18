/** Matches A06 `factory_catalog_export.schema.CATALOG_EXPORT_VERSION`. */
export const CATALOG_EXPORT_VERSION = 1

/** Matches A06 `factory_catalog_export.schema.SECTION_SCHEMA_VERSION`. */
export const SECTION_SCHEMA_VERSION = 1

/** A06 section export order used when recomputing `content_tree_sha256`. */
export const CATALOG_SECTION_ORDER = [
  "midi_clips",
  "solo_phrases",
  "vocal_phrases",
  "cmudict",
  "factory_songs",
  "keyboard_catalog",
] as const

export type CatalogSectionName = (typeof CATALOG_SECTION_ORDER)[number]

/** Tables / stable-id prefixes that must never appear in a factory import. */
export const PROHIBITED_SECTION_NAMES = [
  "jam_songs",
  "jam_clips",
  "jam_section_takes",
] as const

export const PROHIBITED_STABLE_ID_PREFIXES = [
  "jam_song:",
  "jam_clip:",
  "jam_section_take:",
] as const
