import rawCatalog from "@/data/demo/styles.json"
import type {
  KeyboardProfile,
  StyleCatalogEntry,
  StyleWireMapping,
  YamahaModelId,
} from "@/lib/yamaha/types"
import { wireCodeForKeyboard } from "@/lib/yamaha/style-selection"

const catalog = rawCatalog as Record<YamahaModelId, StyleCatalogEntry[]>

export function stylesForProfile(profile: KeyboardProfile): StyleCatalogEntry[] {
  return catalog[profile.id]
}

export function styleMappingForEntry(
  profile: KeyboardProfile,
  style: StyleCatalogEntry,
): StyleWireMapping {
  const code = wireCodeForKeyboard(profile.id, style.styleNumber)
  if (!code.valid) {
    throw new Error(`Invalid style number ${style.styleNumber} for ${profile.id}`)
  }
  return {
    name: style.name,
    category: style.category,
    bytes: [code.first, code.second],
    sourceCatalogValue: style.styleNumber,
  }
}
