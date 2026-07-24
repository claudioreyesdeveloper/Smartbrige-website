/**
 * Drum section types for Style Maker — fixed UI list matching the product
 * request: intro, verse, pre-chorus, chorus, bridge, fill-ins.
 * Every drum clip is normalized into one of these (no untyped leftovers).
 */

export const DRUM_SECTION_OPTIONS: { id: string; label: string }[] = [
  { id: "", label: "All Types" },
  { id: "intro", label: "Intro" },
  { id: "verse", label: "Verse" },
  { id: "pre_chorus", label: "Pre-Chorus" },
  { id: "chorus", label: "Chorus" },
  { id: "bridge", label: "Bridge" },
  { id: "fill_ins", label: "Fill-ins" },
]

const CANONICAL = new Set(
  DRUM_SECTION_OPTIONS.map((o) => o.id).filter(Boolean),
)

/**
 * Map any stored section_type onto the six canonical drum types.
 * Fill-like names → fill_ins; endings/transitions → bridge; generic grooves → verse.
 */
export function normalizeDrumSectionType(
  raw: string | null | undefined,
): string {
  const key = (raw || "").trim().toLowerCase().replace(/ /g, "_")
  if (!key) return "verse"
  if (CANONICAL.has(key)) return key

  if (
    key === "fill" ||
    key === "fills" ||
    key === "fill-ins" ||
    key === "fill_ins" ||
    key.includes("fill") ||
    key === "pickup" ||
    key === "pickups"
  ) {
    return "fill_ins"
  }

  if (key === "pre-chorus" || key === "prechorus") return "pre_chorus"

  if (
    key === "ending" ||
    key === "endings" ||
    key === "outro" ||
    key === "interlude" ||
    key === "breakdown" ||
    key === "buildup" ||
    key === "transition"
  ) {
    return "bridge"
  }

  if (key === "intro") return "intro"
  if (key === "verse" || key === "verse_2") return "verse"
  if (key === "chorus") return "chorus"
  if (key === "bridge") return "bridge"

  // Pack-specific groove / percussion labels → verse (main groove body)
  return "verse"
}

export function sectionLooksLikeDrumFill(sectionType: string | null | undefined): boolean {
  return normalizeDrumSectionType(sectionType) === "fill_ins"
}
