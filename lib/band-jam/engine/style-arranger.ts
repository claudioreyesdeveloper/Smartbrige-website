import type {
  Arrangement,
  BandPart,
  BandStyle,
  SectionRole,
} from "@/lib/band-jam/engine/types"

export const ARRANGER_PARTS: BandPart[] = [
  "drums",
  "bass",
  "guitar",
  "keys",
  "solo",
]

export const ARRANGER_SECTION_ROLES: SectionRole[] = [
  "intro",
  "verse",
  "pre_chorus",
  "chorus",
  "bridge",
  "outro",
  "section",
]

export type SectionPartPlan = Record<
  SectionRole,
  Record<BandPart, boolean>
>

export type StyleArrangerState = SectionPartPlan[]

/** Desktop Main A-D meaning for legacy/generic section labels. */
export function arrangerRoleForSection(
  role: SectionRole,
  styleVariation?: string,
): SectionRole {
  if (role !== "section") return role
  if (styleVariation === "A") return "verse"
  if (styleVariation === "B") return "intro"
  if (styleVariation === "C") return "pre_chorus"
  if (styleVariation === "D") return "chorus"
  return "section"
}

const BASE_DISABLED_PARTS: Record<string, ReadonlySet<BandPart>> = {
  // Rock's curated guitar templates already carry the harmony.
  rock: new Set<BandPart>(["keys"]),
}

export function isPartDisabledByDefault(
  style: BandStyle,
  variation: number,
  part: BandPart,
): boolean {
  if (BASE_DISABLED_PARTS[style.id]?.has(part)) return true
  return style.disabledPartsByVariation?.[variation]?.includes(part) ?? false
}

export function buildDefaultStyleArranger(
  style: BandStyle,
  variationCount = 4,
): StyleArrangerState {
  return Array.from({ length: variationCount }, (_, variation) =>
    Object.fromEntries(
      ARRANGER_SECTION_ROLES.map((role) => [
        role,
        Object.fromEntries(
          ARRANGER_PARTS.map((part) => [
            part,
            Boolean(style.parts[part]) &&
              !isPartDisabledByDefault(style, variation, part),
          ]),
        ) as Record<BandPart, boolean>,
      ]),
    ) as SectionPartPlan,
  )
}

/**
 * Remove only the notes belonging to disabled section/part cells.
 *
 * The chart's section spans are the authority. This keeps the arranger out of
 * clip selection and harmony: it changes orchestration only, after the normal
 * SmartBridge arrangement has already been built.
 */
export function applySectionPartPlan(
  arrangement: Arrangement,
  plan?: SectionPartPlan | null,
): Arrangement {
  if (!plan) return arrangement

  const spans = arrangement.sections.map((section) => ({
    role: arrangerRoleForSection(section.role, section.styleVariation),
    startBeat: (section.startBar - 1) * 4,
    endBeat: section.endBar * 4,
  }))

  return {
    ...arrangement,
    parts: arrangement.parts
      .map((part) => ({
        ...part,
        events: part.events.filter((event) => {
          const span = spans.find(
            (candidate) =>
              event.beat >= candidate.startBeat && event.beat < candidate.endBeat,
          )
          if (!span) return true
          return plan[span.role]?.[part.part] !== false
        }),
      }))
      .filter((part) => part.events.length > 0),
  }
}
