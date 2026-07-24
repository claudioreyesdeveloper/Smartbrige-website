import rawCatalog from "@/data/demo/styles.json"
import type {
  KeyboardProfile,
  StyleCatalogEntry,
  StyleWireMapping,
  YamahaModelId,
} from "@/lib/demo/types"
import { encodeStyleWireBytes } from "@/lib/demo/yamaha/keyboard-models"

const catalog = rawCatalog as Partial<Record<YamahaModelId, StyleCatalogEntry[]>>

/** Static JSON fallback (genos / genos2 / tyros4 / tyros5). Prefer DB via API. */
export function stylesForProfile(profile: KeyboardProfile): StyleCatalogEntry[] {
  return catalog[profile.id] ?? []
}

export function styleMappingForEntry(
  profile: KeyboardProfile,
  style: StyleCatalogEntry,
): StyleWireMapping {
  const bytes = encodeStyleWireBytes(profile.id, style.styleNumber) ?? [0, 0]
  return {
    name: style.name,
    category: style.category,
    bytes,
    sourceCatalogValue: style.styleNumber,
  }
}
