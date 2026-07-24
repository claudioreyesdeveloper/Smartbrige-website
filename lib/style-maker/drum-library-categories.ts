/**
 * Drum Performance library hides cinematic / percussion packs
 * (Cinematic Percussion, Latin Percussion, Funk Percussion, Action Drums).
 * Groove categories (Pop, Rock, Funk, …) stay available.
 */

export function normalizeDrumCategoryKey(
  categoryName: string | null | undefined,
): string {
  return (categoryName || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
}

/** True for packs that should not appear in Style Maker Drum Performance. */
export function isExcludedDrumLibraryCategory(
  categoryName: string | null | undefined,
): boolean {
  const cat = normalizeDrumCategoryKey(categoryName)
  if (!cat) return false
  if (cat.includes("percussion")) return true
  if (cat.includes("cinematic")) return true
  if (cat === "action_drums" || cat.startsWith("action_")) return true
  return false
}

export function filterDrumLibraryCategories(categories: string[]): string[] {
  return categories.filter((name) => !isExcludedDrumLibraryCategory(name))
}
