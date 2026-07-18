import { CatalogError } from "@/lib/catalog/errors"
import {
  CATALOG_EXPORT_VERSION,
  CATALOG_SECTION_ORDER,
  PROHIBITED_SECTION_NAMES,
  PROHIBITED_STABLE_ID_PREFIXES,
  SECTION_SCHEMA_VERSION,
  type CatalogSectionName,
} from "@/lib/catalog/constants"
import { canonicalJsonSha256, sha256Bytes } from "@/lib/catalog/canonical"
import { isCatalogSectionName } from "@/lib/catalog/mapping"

export type TopLevelManifest = {
  catalog_export_version: number
  schema_version: number
  source_provenance: Record<string, unknown>
  sections: Record<
    string,
    {
      manifest_path: string
      record_count: number
      records_sha256: string
    }
  >
  content_tree_sha256: string
}

export type SectionManifest = {
  section: string
  schema_version: number
  record_count: number
  records: Record<string, unknown>[]
  records_sha256: string
}

export type CatalogAssetRef = {
  path: string
  sha256: string
  size_bytes: number
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseTopLevelManifest(raw: unknown): TopLevelManifest {
  if (!isPlainObject(raw)) {
    throw new CatalogError("validation", "Top-level manifest must be a JSON object.")
  }

  const errors: string[] = []
  for (const key of [
    "catalog_export_version",
    "schema_version",
    "source_provenance",
    "sections",
    "content_tree_sha256",
  ]) {
    if (!(key in raw)) {
      errors.push(`missing top-level key: ${key}`)
    }
  }

  if (raw.catalog_export_version !== CATALOG_EXPORT_VERSION) {
    errors.push(
      `catalog_export_version must be ${CATALOG_EXPORT_VERSION}, got ${String(raw.catalog_export_version)}`,
    )
  }
  if (raw.schema_version !== SECTION_SCHEMA_VERSION) {
    errors.push(
      `schema_version must be ${SECTION_SCHEMA_VERSION}, got ${String(raw.schema_version)}`,
    )
  }
  if (!isPlainObject(raw.source_provenance)) {
    errors.push("source_provenance must be an object")
  } else if (typeof raw.source_provenance.database_content_sha256 !== "string") {
    errors.push("source_provenance.database_content_sha256 must be a string")
  }
  if (!isPlainObject(raw.sections)) {
    errors.push("sections must be an object")
  }
  if (typeof raw.content_tree_sha256 !== "string") {
    errors.push("content_tree_sha256 must be a string")
  }

  if (errors.length > 0) {
    throw new CatalogError("validation", `Invalid top-level manifest: ${errors.join("; ")}`)
  }

  for (const name of Object.keys(raw.sections as Record<string, unknown>)) {
    if ((PROHIBITED_SECTION_NAMES as readonly string[]).includes(name)) {
      throw new CatalogError(
        "validation",
        `Prohibited user/jam section present in manifest: ${name}`,
      )
    }
    if (!isCatalogSectionName(name)) {
      throw new CatalogError("validation", `Unknown catalog section: ${name}`)
    }
  }

  return raw as TopLevelManifest
}

export function parseSectionManifest(raw: unknown): SectionManifest {
  if (!isPlainObject(raw)) {
    throw new CatalogError("validation", "Section manifest must be a JSON object.")
  }

  const errors: string[] = []
  for (const key of ["section", "schema_version", "record_count", "records", "records_sha256"]) {
    if (!(key in raw)) {
      errors.push(`missing section key: ${key}`)
    }
  }
  if (raw.schema_version !== SECTION_SCHEMA_VERSION) {
    errors.push(
      `section schema_version must be ${SECTION_SCHEMA_VERSION}, got ${String(raw.schema_version)}`,
    )
  }
  if (!Array.isArray(raw.records)) {
    errors.push("records must be an array")
  } else if (raw.record_count !== raw.records.length) {
    errors.push(
      `record_count (${String(raw.record_count)}) != len(records) (${raw.records.length})`,
    )
  }
  if (typeof raw.records_sha256 !== "string") {
    errors.push("records_sha256 must be a string")
  }
  if (typeof raw.section !== "string" || !isCatalogSectionName(raw.section)) {
    errors.push(`section must be a known catalog section, got ${String(raw.section)}`)
  }

  if (errors.length > 0) {
    throw new CatalogError("validation", `Invalid section manifest: ${errors.join("; ")}`)
  }

  const section = raw.section as CatalogSectionName
  if ((PROHIBITED_SECTION_NAMES as readonly string[]).includes(section)) {
    throw new CatalogError("validation", `Prohibited user/jam section: ${section}`)
  }

  const records = raw.records as unknown[]
  for (let idx = 0; idx < records.length; idx += 1) {
    const record = records[idx]
    if (!isPlainObject(record)) {
      throw new CatalogError("validation", `records[${idx}] must be an object`)
    }
    if (typeof record.stable_id !== "string" || !record.stable_id) {
      throw new CatalogError("validation", `records[${idx}] missing stable_id`)
    }
    assertStableIdAllowed(record.stable_id)
    assertNoProhibitedUserFlags(record, `records[${idx}]`)
  }

  return {
    section,
    schema_version: raw.schema_version as number,
    record_count: raw.record_count as number,
    records: records as Record<string, unknown>[],
    records_sha256: raw.records_sha256 as string,
  }
}

export function assertStableIdAllowed(stableId: string): void {
  for (const prefix of PROHIBITED_STABLE_ID_PREFIXES) {
    if (stableId.startsWith(prefix)) {
      throw new CatalogError(
        "validation",
        `Prohibited user/jam stable_id rejected: ${stableId}`,
      )
    }
  }
  if (!/^[A-Za-z0-9_.:-]+$/.test(stableId)) {
    throw new CatalogError("validation", `Invalid stable_id characters: ${stableId}`)
  }
}

function assertNoProhibitedUserFlags(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoProhibitedUserFlags(item, `${path}[${index}]`))
    return
  }
  if (!isPlainObject(value)) {
    return
  }
  if (value.is_user_override === 1 || value.is_user_override === true) {
    throw new CatalogError(
      "validation",
      `Prohibited user override content at ${path}`,
    )
  }
  for (const [key, child] of Object.entries(value)) {
    assertNoProhibitedUserFlags(child, `${path}.${key}`)
  }
}

export function verifyRecordsChecksum(manifest: SectionManifest): void {
  const actual = canonicalJsonSha256(manifest.records)
  if (actual !== manifest.records_sha256.toLowerCase()) {
    throw new CatalogError(
      "checksum_mismatch",
      `records_sha256 mismatch for section ${manifest.section}`,
    )
  }
}

/**
 * Match A06 `_build_section`: only `record.asset.sha256` contributes to the
 * content-tree fingerprint. Nested assets are covered by records_sha256 and
 * are independently read and verified during import.
 */
export function collectTopLevelAssetChecksums(
  records: Record<string, unknown>[],
): string[] {
  const checksums: string[] = []
  for (const record of records) {
    const asset = parseAssetRef(record.asset, `${String(record.stable_id)}.asset`)
    if (asset) {
      checksums.push(asset.sha256)
    }
  }
  return checksums
}

export function verifyContentTreeSha256(
  sectionManifests: SectionManifest[],
  declared: string,
): string {
  const byName = new Map(sectionManifests.map((manifest) => [manifest.section, manifest]))
  const contentParts: string[] = []

  for (const section of CATALOG_SECTION_ORDER) {
    const manifest = byName.get(section)
    if (!manifest) {
      continue
    }
    contentParts.push(manifest.records_sha256.toLowerCase())
    contentParts.push(...collectTopLevelAssetChecksums(manifest.records).sort())
  }

  const actual = canonicalJsonSha256(contentParts)
  if (actual !== declared.toLowerCase()) {
    throw new CatalogError(
      "checksum_mismatch",
      "content_tree_sha256 does not match recomputed fingerprint",
    )
  }
  return actual
}

export function assertSafeAssetPath(assetPath: string): string {
  const normalized = assetPath.replace(/\\/g, "/")
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("..") ||
    normalized.includes("\0") ||
    normalized.includes("//")
  ) {
    throw new CatalogError("validation", `Unsafe asset path rejected: ${assetPath}`)
  }
  if (!/^assets\/[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new CatalogError(
      "validation",
      `Asset path must be a safe relative assets/ filename: ${assetPath}`,
    )
  }
  return normalized
}

export function parseAssetRef(value: unknown, context: string): CatalogAssetRef | null {
  if (value == null) {
    return null
  }
  if (!isPlainObject(value)) {
    throw new CatalogError("validation", `${context}: asset must be an object`)
  }
  if (
    typeof value.path !== "string" ||
    typeof value.sha256 !== "string" ||
    typeof value.size_bytes !== "number"
  ) {
    throw new CatalogError(
      "validation",
      `${context}: asset requires path, sha256, and size_bytes`,
    )
  }
  if (!Number.isInteger(value.size_bytes) || value.size_bytes <= 0) {
    throw new CatalogError("validation", `${context}: asset size_bytes must be a positive integer`)
  }
  if (!/^[a-f0-9]{64}$/i.test(value.sha256)) {
    throw new CatalogError("validation", `${context}: asset sha256 must be 64 hex chars`)
  }
  return {
    path: assertSafeAssetPath(value.path),
    sha256: value.sha256.toLowerCase(),
    size_bytes: value.size_bytes,
  }
}

export function verifyAssetBytes(body: Uint8Array, asset: CatalogAssetRef, context: string): void {
  if (body.byteLength !== asset.size_bytes) {
    throw new CatalogError(
      "checksum_mismatch",
      `${context}: asset size mismatch (expected ${asset.size_bytes}, got ${body.byteLength})`,
    )
  }
  const digest = sha256Bytes(body)
  if (digest !== asset.sha256) {
    throw new CatalogError(
      "checksum_mismatch",
      `${context}: asset sha256 mismatch for ${asset.path}`,
    )
  }
}

export function walkAssets(
  value: unknown,
  visitor: (asset: CatalogAssetRef, path: string) => void,
  path = "$",
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkAssets(item, visitor, `${path}[${index}]`))
    return
  }
  if (!isPlainObject(value)) {
    return
  }
  if ("asset" in value) {
    const asset = parseAssetRef(value.asset, `${path}.asset`)
    if (asset) {
      visitor(asset, `${path}.asset`)
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "asset") {
      continue
    }
    walkAssets(child, visitor, `${path}.${key}`)
  }
}

export function flattenImportRecords(
  section: CatalogSectionName,
  records: Record<string, unknown>[],
): Array<{
  stableId: string
  kind: string
  metadata: Record<string, unknown>
  asset: CatalogAssetRef | null
}> {
  const out: Array<{
    stableId: string
    kind: string
    metadata: Record<string, unknown>
    asset: CatalogAssetRef | null
  }> = []

  for (const record of records) {
    const stableId = String(record.stable_id)
    assertStableIdAllowed(stableId)

    if (section === "factory_songs") {
      flattenFactorySong(record, out)
      continue
    }

    const asset = parseAssetRef(record.asset, `${stableId}.asset`)
    out.push({
      stableId,
      kind: stableId.split(":")[0] ?? section,
      metadata: stripFilesystemLeakage(record),
      asset,
    })
  }

  return out
}

function flattenFactorySong(
  record: Record<string, unknown>,
  out: Array<{
    stableId: string
    kind: string
    metadata: Record<string, unknown>
    asset: CatalogAssetRef | null
  }>,
): void {
  const stableId = String(record.stable_id)
  const clips = Array.isArray(record.clips) ? record.clips : []
  const chordBlocks = Array.isArray(record.chord_blocks) ? record.chord_blocks : []

  out.push({
    stableId,
    kind: stableId.split(":")[0] ?? "factory_song",
    metadata: stripFilesystemLeakage({
      ...record,
      clips: undefined,
      chord_blocks: undefined,
      clip_count: clips.length,
      chord_block_count: chordBlocks.length,
    }),
    asset: null,
  })

  for (const clipValue of clips) {
    if (!isPlainObject(clipValue) || typeof clipValue.stable_id !== "string") {
      throw new CatalogError("validation", `Invalid factory clip under ${stableId}`)
    }
    const clipStableId = clipValue.stable_id
    assertStableIdAllowed(clipStableId)
    const clipAsset = parseAssetRef(clipValue.asset, `${clipStableId}.asset`)
    const variations = Array.isArray(clipValue.variations) ? clipValue.variations : []

    out.push({
      stableId: clipStableId,
      kind: "factory_clip",
      metadata: stripFilesystemLeakage({
        ...clipValue,
        song_stable_id: stableId,
        variations: undefined,
        variation_count: variations.length,
      }),
      asset: clipAsset,
    })

    for (const variationValue of variations) {
      if (!isPlainObject(variationValue) || typeof variationValue.stable_id !== "string") {
        throw new CatalogError("validation", `Invalid factory variation under ${clipStableId}`)
      }
      const variationStableId = variationValue.stable_id
      assertStableIdAllowed(variationStableId)
      out.push({
        stableId: variationStableId,
        kind: "factory_clip_variation",
        metadata: stripFilesystemLeakage({
          ...variationValue,
          clip_stable_id: clipStableId,
          song_stable_id: stableId,
        }),
        asset: parseAssetRef(variationValue.asset, `${variationStableId}.asset`),
      })
    }
  }

  for (const blockValue of chordBlocks) {
    if (!isPlainObject(blockValue) || typeof blockValue.stable_id !== "string") {
      throw new CatalogError("validation", `Invalid factory chord block under ${stableId}`)
    }
    const blockStableId = blockValue.stable_id
    assertStableIdAllowed(blockStableId)
    out.push({
      stableId: blockStableId,
      kind: "factory_chord_block",
      metadata: stripFilesystemLeakage({
        ...blockValue,
        song_stable_id: stableId,
      }),
      asset: null,
    })
  }
}

/** Remove absolute-looking path leakage from API-facing metadata. */
export function stripFilesystemLeakage(value: unknown): Record<string, unknown> {
  return stripDeep(value) as Record<string, unknown>
}

function stripDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripDeep)
  }
  if (!isPlainObject(value)) {
    return value
  }
  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) {
      continue
    }
    if (key === "path" && typeof child === "string" && child.startsWith("assets/")) {
      // Keep relative bundle asset path out of API metadata; blob id is authoritative.
      continue
    }
    if (
      (key === "path" || key === "source_file" || key === "midi_path" || key === "source_path") &&
      typeof child === "string" &&
      (child.startsWith("/") || child.includes("..") || /^[A-Za-z]:[\\/]/.test(child))
    ) {
      out[key] = child.replace(/\\/g, "/").split("/").pop() ?? null
      continue
    }
    out[key] = stripDeep(child)
  }
  return out
}
