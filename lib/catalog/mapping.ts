import {
  getSharedServiceCatalogEntry,
  isServiceKey,
  type ServiceKey,
} from "@/lib/services/catalog"
import { CatalogError } from "@/lib/catalog/errors"
import {
  CATALOG_SECTION_ORDER,
  type CatalogSectionName,
} from "@/lib/catalog/constants"

/**
 * A06 section → SaaS service mapping.
 *
 * Mapped:
 * - midi_clips → bass-drums
 * - solo_phrases → solo-phrases
 * - vocal_phrases + cmudict → lyrics
 * - factory_songs (songs/clips/chords/roman patterns) → jam-player
 * - keyboard_catalog (styles and nested voices/multipads) → jam-player
 *
 * Fail closed (no catalog API):
 * - genos-mixer — active product surface, but no dedicated A06 section mapping yet
 * - style-maker — future service
 */
export const SECTION_TO_SERVICE: Readonly<Record<CatalogSectionName, ServiceKey>> = {
  midi_clips: "bass-drums",
  solo_phrases: "solo-phrases",
  vocal_phrases: "lyrics",
  cmudict: "lyrics",
  factory_songs: "jam-player",
  keyboard_catalog: "jam-player",
}

/** Services that currently expose a factory catalog API. */
export const CATALOG_ENABLED_SERVICES: readonly ServiceKey[] = [
  "bass-drums",
  "solo-phrases",
  "lyrics",
  "jam-player",
]

export function isCatalogSectionName(value: string): value is CatalogSectionName {
  return (CATALOG_SECTION_ORDER as readonly string[]).includes(value)
}

export function serviceKeyForSection(section: CatalogSectionName): ServiceKey {
  return SECTION_TO_SERVICE[section]
}

export function assertCatalogServiceAvailable(serviceKey: string): ServiceKey {
  if (!isServiceKey(serviceKey)) {
    throw new CatalogError("validation", `Unknown service key: ${serviceKey}`)
  }

  const entry = getSharedServiceCatalogEntry(serviceKey)
  if (entry.availability === "future") {
    throw new CatalogError("forbidden", `Service is not available for catalog access: ${serviceKey}`)
  }

  if (!CATALOG_ENABLED_SERVICES.includes(serviceKey)) {
    throw new CatalogError(
      "forbidden",
      `No factory catalog is mapped for service: ${serviceKey}`,
    )
  }

  return serviceKey
}

export function kindFromStableId(stableId: string): string {
  const colon = stableId.indexOf(":")
  return colon > 0 ? stableId.slice(0, colon) : "unknown"
}
