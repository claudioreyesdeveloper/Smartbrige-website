import { createHash } from "node:crypto"

/** Match A06 `serialize.canonical_json` (sorted keys, compact separators, Unicode kept). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value))
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex")
}

export function sha256Bytes(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex")
}

export function canonicalJsonSha256(value: unknown): string {
  return sha256Text(canonicalJson(value))
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep)
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortKeysDeep(record[key])
    }
    return sorted
  }
  return value
}
