/** Bounded payload sizes for project documents and API bodies. */

export const PROJECT_TITLE_MAX_LENGTH = 200
export const PROJECT_DOCUMENT_MAX_BYTES = 512 * 1024
export const PROJECT_SECTIONS_MAX = 256
export const PROJECT_CHORDS_PER_SECTION_MAX = 512
export const PROJECT_SOLOS_MAX = 64
export const PROJECT_BLOBS_MAX = 128
export const PROJECT_MIXER_CHANNELS_MAX = 32
export const PROJECT_LYRICS_TEXT_MAX = 50_000
export const PROJECT_API_BODY_MAX_BYTES = PROJECT_DOCUMENT_MAX_BYTES + 4 * 1024
