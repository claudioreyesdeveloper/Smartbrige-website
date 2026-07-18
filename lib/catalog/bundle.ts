import { readFile } from "node:fs/promises"
import path from "node:path"
import { CatalogError } from "@/lib/catalog/errors"
import {
  parseSectionManifest,
  parseTopLevelManifest,
  type SectionManifest,
  type TopLevelManifest,
} from "@/lib/catalog/manifest"
import type { CatalogSectionName } from "@/lib/catalog/constants"

export type CatalogBundleReader = {
  readTopManifest: () => Promise<TopLevelManifest>
  readSectionManifest: (section: CatalogSectionName, relativePath: string) => Promise<SectionManifest>
  readAssetBytes: (section: CatalogSectionName, relativeAssetPath: string) => Promise<Uint8Array>
}

export function createMemoryCatalogBundle(input: {
  top: TopLevelManifest
  sections: Record<string, SectionManifest>
  assets: Record<string, Uint8Array>
}): CatalogBundleReader {
  return {
    async readTopManifest() {
      return parseTopLevelManifest(input.top)
    },
    async readSectionManifest(section, relativePath) {
      const manifest = input.sections[section]
      if (!manifest) {
        throw new CatalogError("validation", `Missing section manifest: ${relativePath}`)
      }
      return parseSectionManifest(manifest)
    },
    async readAssetBytes(section, relativeAssetPath) {
      const key = `${section}/${relativeAssetPath}`
      const body = input.assets[key]
      if (!body) {
        throw new CatalogError("validation", `Missing asset bytes: ${key}`)
      }
      return body
    },
  }
}

/** Local filesystem A06 export directory reader (never mutates the desktop DB). */
export function createFilesystemCatalogBundle(rootDir: string): CatalogBundleReader {
  const root = path.resolve(rootDir)

  function resolveUnderRoot(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, "/")
    if (
      !normalized ||
      normalized.startsWith("/") ||
      normalized.includes("..") ||
      normalized.includes("\0")
    ) {
      throw new CatalogError("validation", `Unsafe bundle path: ${relativePath}`)
    }
    const absolute = path.resolve(root, normalized)
    if (!absolute.startsWith(root + path.sep) && absolute !== root) {
      throw new CatalogError("validation", `Path escapes bundle root: ${relativePath}`)
    }
    return absolute
  }

  return {
    async readTopManifest() {
      const text = await readFile(resolveUnderRoot("manifest.json"), "utf8")
      return parseTopLevelManifest(JSON.parse(text) as unknown)
    },
    async readSectionManifest(_section, relativePath) {
      const text = await readFile(resolveUnderRoot(relativePath), "utf8")
      return parseSectionManifest(JSON.parse(text) as unknown)
    },
    async readAssetBytes(section, relativeAssetPath) {
      const absolute = resolveUnderRoot(path.posix.join(section, relativeAssetPath))
      const buffer = await readFile(absolute)
      return new Uint8Array(buffer)
    },
  }
}
