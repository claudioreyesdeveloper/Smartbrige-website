import rawCatalog from "@/data/demo/styles.json"
import type {
  KeyboardProfile,
  StyleCatalogEntry,
  StyleWireMapping,
  YamahaModelId,
} from "@/lib/demo/types"

const catalog = rawCatalog as Record<YamahaModelId, StyleCatalogEntry[]>

export function stylesForProfile(profile: KeyboardProfile): StyleCatalogEntry[] {
  return catalog[profile.id]
}

export function styleMappingForEntry(
  profile: KeyboardProfile,
  style: StyleCatalogEntry,
): StyleWireMapping {
  const numeric14Bit = profile.id === "genos" || profile.id === "genos2"
  const first = numeric14Bit
    ? (style.styleNumber >> 7) & 0x7f
    : (style.styleNumber >> 8) & 0x7f
  const second = style.styleNumber & 0x7f
  return {
    name: style.name,
    category: style.category,
    bytes: [first, second],
    sourceCatalogValue: style.styleNumber,
  }
}
