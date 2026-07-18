import { describe, expect, it } from "vitest"
import { buildStorageKey, parseFactoryServiceKey } from "@/lib/storage/keys"
import { StorageError } from "@/lib/storage/errors"
import {
  assertAllowedByteSize,
  resolveAssetKind,
  sanitizeFilename,
} from "@/lib/storage/validation"
import { MAX_ASSET_BYTES } from "@/lib/storage/constants"

describe("storage validation", () => {
  it("accepts MIDI and project kinds with matching types", () => {
    expect(resolveAssetKind("loop.mid", "audio/midi")).toBe("midi")
    expect(resolveAssetKind("song.json", "application/json")).toBe("project")
  })

  it("rejects path traversal in filenames", () => {
    expect(() => sanitizeFilename("../../etc/passwd")).toThrow(StorageError)
    expect(() => sanitizeFilename("a/b.mid")).toThrow(StorageError)
  })

  it("builds factory and user storage keys without traversal", () => {
    expect(
      buildStorageKey({
        kind: "factory",
        serviceKey: "jam-player",
        checksumSha256: "a".repeat(64),
        assetKind: "midi",
      }),
    ).toBe(`factory/jam-player/${"a".repeat(64)}.mid`)

    expect(parseFactoryServiceKey(`factory/solo-phrases/${"b".repeat(64)}.mid`)).toBe(
      "solo-phrases",
    )
    expect(parseFactoryServiceKey("users/u/uploads/x.mid")).toBeNull()
  })

  it("enforces size bounds", () => {
    expect(() => assertAllowedByteSize(0)).toThrow(StorageError)
    expect(() => assertAllowedByteSize(MAX_ASSET_BYTES + 1)).toThrow(StorageError)
    expect(() => assertAllowedByteSize(128)).not.toThrow()
  })
})
