/**
 * Desktop Jam Player Tyros-style categories.
 * Source: SmartBridge JamPlayerScreen::mapToTyrosCategory / populateCategoryCombo.
 */

export const JAM_TYROS_CATEGORIES = [
  "Pop",
  "Rock",
  "Ballad",
  "Dance",
  "Latin",
  "Swing&Jazz",
  "R&B",
  "Country",
  "Ballroom",
  "World",
  "Movie&Show",
  "Entertainer",
  "User",
] as const

export type JamTyrosCategory = (typeof JAM_TYROS_CATEGORIES)[number]

/** Fold raw EZkeys / factory_songs.category into a Tyros display category. */
export function mapToTyrosCategory(rawCategory: string | null | undefined): JamTyrosCategory {
  const value = (rawCategory ?? "").trim()
  // Already folded (DB stores Tyros labels after import remap).
  if ((JAM_TYROS_CATEGORIES as readonly string[]).includes(value)) {
    return value as JamTyrosCategory
  }
  if (value === "Chord Sheets") return "User"
  if (value === "Hooks" || value === "Keys" || value === "New") return "Pop"
  if (value === "Metal" || value === "Acoustic") return "Rock"
  if (value === "Ballads" || value === "Atmospheric" || value === "Classic") return "Ballad"
  if (value === "Electronic" || value === "Hip Hop") return "Dance"
  if (
    value === "Jazz" ||
    value === "Swing" ||
    value === "Blues" ||
    value === "Shuffles"
  ) {
    return "Swing&Jazz"
  }
  if (
    value === "Soul" ||
    value === "Funk" ||
    value === "Gospel" ||
    value === "Organ" ||
    value === "Fusion"
  ) {
    return "R&B"
  }
  if (value === "Orchestral") return "Ballroom"
  if (value === "Reggae") return "World"
  if (value === "Cinematic" || value === "Musicals" || value === "Movie Scores") {
    return "Movie&Show"
  }
  return "User"
}
