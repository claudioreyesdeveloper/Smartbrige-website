/** Hard caps mirroring the private algorithm-service public-safe v1 contract. */
export const BODY_LIMIT_BYTES = 256 * 1024

export const MAX_SECTIONS = 64
export const MAX_CHORDS_PER_SECTION = 128
export const MAX_TOTAL_CHORDS = 512
export const MAX_DISPATCH_EVENTS_FULL_SONG = 20_000
export const MAX_DISPATCH_EVENTS_PER_SECTION = 5_000
export const MAX_REHARMONIZE_CANDIDATES = 12
export const MAX_BYTES_FIELD_CHARS = 16_384
export const MAX_DISPATCH_EVENT_BYTES = 12_288
export const MAX_SECTION_ID_LENGTH = 64
export const MAX_CHORD_SYMBOL_LENGTH = 32
export const MAX_SECTION_NAME_LENGTH = 64
export const MAX_OPAQUE_ID_LENGTH = 128
export const MAX_PROJECT_ID_LENGTH = 128
export const MIN_REQUEST_ID_LENGTH = 16
export const MAX_REQUEST_ID_LENGTH = 128

/** Default HMAC timestamp skew window (seconds). */
export const DEFAULT_HMAC_MAX_SKEW_SECONDS = 60

export const CONTRACT_VERSION = "v1"
