/**
 * Bridge between website YamahaModelId and desktop smartbridge.db
 * keyboard_models.model_key / style wire encoding.
 */

import type { YamahaModelId } from "@/lib/demo/types"

/** DB model_key values present in keyboard_models (bundled snapshot). */
export const DB_MODEL_KEYS = [
  "genos1",
  "genos2",
  "tyros1",
  "tyros2",
  "tyros3",
  "tyros4",
  "tyros5",
  "psr_s750",
  "psr_s770",
  "psr_s775",
  "psr_s900",
  "psr_s950",
  "psr_s970",
  "psr_s975",
  "psr_sx700",
  "psr_sx900",
] as const

export type DbModelKey = (typeof DB_MODEL_KEYS)[number]

/** Website id → DB model_key (genos → genos1). */
export function dbModelKey(modelId: YamahaModelId | string | null | undefined): DbModelKey | null {
  if (!modelId) return null
  const id = modelId.trim().toLowerCase()
  if (id === "genos" || id === "genos1") return "genos1"
  if ((DB_MODEL_KEYS as readonly string[]).includes(id)) return id as DbModelKey
  return null
}

/** Desktop YamahaStyleSelection::encodingForKeyboardType — Genos family = 14-bit. */
export function usesNumeric14BitStyleEncoding(
  modelId: YamahaModelId | string | null | undefined,
): boolean {
  const key = dbModelKey(modelId)
  return key === "genos1" || key === "genos2"
}

export function isGenosFamilyModelId(
  modelId: YamahaModelId | string | null | undefined,
): boolean {
  const key = dbModelKey(modelId)
  return key === "genos1" || key === "genos2"
}

export function encodeStyleWireBytes(
  modelId: YamahaModelId | string | null | undefined,
  styleNumber: number,
): [number, number] | null {
  if (!Number.isFinite(styleNumber) || styleNumber < 0) return null
  if (usesNumeric14BitStyleEncoding(modelId)) {
    if (styleNumber > 0x3fff) return null
    return [(styleNumber >> 7) & 0x7f, styleNumber & 0x7f]
  }
  if (styleNumber > 0xffff) return null
  return [(styleNumber >> 8) & 0x7f, styleNumber & 0x7f]
}
