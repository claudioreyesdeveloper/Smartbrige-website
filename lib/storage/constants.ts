import type { AllowedAssetKind } from "@/lib/storage/types"

/** Server-side upload cap (under typical Vercel request body limits). */
export const MAX_ASSET_BYTES = 4 * 1024 * 1024

export const SHORT_LIVED_READ_TTL_MS = 5 * 60 * 1000

export const ALLOWED_CONTENT_TYPES: Readonly<Record<AllowedAssetKind, readonly string[]>> = {
  midi: ["audio/midi", "audio/mid", "application/midi", "application/x-midi"],
  project: ["application/json", "application/vnd.smartbridge.project+json"],
}

export const ALLOWED_EXTENSIONS: Readonly<Record<AllowedAssetKind, readonly string[]>> = {
  midi: [".mid", ".midi"],
  project: [".json"],
}
