/**
 * Free-tier catalogue limits for Jam Player.
 *
 * Launch free pack: all four ear-checked styles (funk / pop / rock / ballad)
 * plus a short progression slice, all practice features, no saved state.
 * Paid unlocks the full progression list + practice memory + Web MIDI out.
 *
 * (Product plan §5 originally said "1 style"; for this first public cut we
 * ship the full launch style set free and gate on breadth of progressions
 * and memory instead.)
 *
 * Styles still pass through the launch filter first (see practice-screen);
 * free further narrows that set if the launch list ever grows.
 */

export const JAM_PLAYER_FREE_STYLE_IDS = [
  "funk",
  "pop",
  "rock",
  "ballad",
] as const

export const JAM_PLAYER_FREE_PROGRESSION_COUNT = 6

export type CatalogSlice<TStyle extends { id: string }, TProg> = {
  styles: TStyle[]
  progressions: TProg[]
}

/** Apply free-tier breadth limits when the user does not have full access. */
export function applyJamPlayerFreeTier<TStyle extends { id: string }, TProg>(
  catalog: CatalogSlice<TStyle, TProg>,
  hasFullAccess: boolean,
): CatalogSlice<TStyle, TProg> {
  if (hasFullAccess) return catalog
  const freeIds = new Set<string>(JAM_PLAYER_FREE_STYLE_IDS)
  return {
    styles: catalog.styles.filter((s) => freeIds.has(s.id)),
    progressions: catalog.progressions.slice(0, JAM_PLAYER_FREE_PROGRESSION_COUNT),
  }
}
