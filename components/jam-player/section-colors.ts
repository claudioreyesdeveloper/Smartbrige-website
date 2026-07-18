/**
 * Desktop Jam Player chord-grid palette (JamPlayerScreen_ChordGrid::getColorForClipIndex)
 * after Intro → Verse → Pre-Chorus → Chorus → Bridge → Outro sort order.
 */
const DESKTOP_SECTION_COLORS = {
  intro: "#00aaff",
  verse: "#00ff88",
  preChorus: "#ff8800",
  chorus: "#ff00ff",
  bridge: "#ffff00",
  outro: "#ff0088",
} as const

const FALLBACK_CYCLE = [
  DESKTOP_SECTION_COLORS.intro,
  DESKTOP_SECTION_COLORS.verse,
  DESKTOP_SECTION_COLORS.preChorus,
  DESKTOP_SECTION_COLORS.chorus,
  DESKTOP_SECTION_COLORS.bridge,
  DESKTOP_SECTION_COLORS.outro,
] as const

/** Map a section label to the desktop timeline accent color. */
export function desktopSectionAccent(label: string, fallbackIndex = 0): string {
  const lower = label.trim().toLowerCase()
  if (lower.includes("intro")) return DESKTOP_SECTION_COLORS.intro
  if (lower.includes("pre") && lower.includes("chorus")) {
    return DESKTOP_SECTION_COLORS.preChorus
  }
  if (lower.includes("chorus")) return DESKTOP_SECTION_COLORS.chorus
  if (lower.includes("verse")) return DESKTOP_SECTION_COLORS.verse
  if (lower.includes("bridge")) return DESKTOP_SECTION_COLORS.bridge
  if (lower.includes("ending") || lower.includes("outro")) {
    return DESKTOP_SECTION_COLORS.outro
  }
  return FALLBACK_CYCLE[Math.abs(fallbackIndex) % FALLBACK_CYCLE.length]!
}
