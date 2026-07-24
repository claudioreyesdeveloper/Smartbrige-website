/**
 * Style Maker section name mapping — StyleMakerEngine::templateSectionForProjectSection.
 * UI / project names (Intro 1, Fill A) ↔ Yamaha MIDI marker / CASM Sdec names (Intro A, Fill In AA).
 */

const LETTERS = ["A", "B", "C", "D"] as const

/** Desktop letterForIndex — 0→A … 3→D. */
function letterForIndex(idx: number): string | null {
  return idx >= 0 && idx < LETTERS.length ? LETTERS[idx] : null
}

function indexForLetter(letter: string): number | null {
  const i = LETTERS.indexOf(letter.toUpperCase() as (typeof LETTERS)[number])
  return i >= 0 ? i : null
}

/**
 * Map a UI / project section name to the Yamaha marker / CASM Sdec name.
 * Already-Yamaha names (Intro A, Fill In AA) pass through normalized.
 */
export function yamahaTemplateSectionName(label: string): string {
  const name = label.trim().replace(/^fn:/i, "").trim()
  if (!name) return name

  if (/^Main\s+[A-D]$/i.test(name)) {
    return `Main ${name.slice(-1).toUpperCase()}`
  }

  const introNum = /^Intro\s+(\d+)$/i.exec(name)
  if (introNum) {
    const letter = letterForIndex(Number(introNum[1]) - 1)
    return letter ? `Intro ${letter}` : name
  }
  const introLetter = /^Intro\s+([A-D])$/i.exec(name)
  if (introLetter) return `Intro ${introLetter[1].toUpperCase()}`

  const endingNum = /^Ending\s+(\d+)$/i.exec(name)
  if (endingNum) {
    const letter = letterForIndex(Number(endingNum[1]) - 1)
    return letter ? `Ending ${letter}` : name
  }
  const endingLetter = /^Ending\s+([A-D])$/i.exec(name)
  if (endingLetter) return `Ending ${endingLetter[1].toUpperCase()}`

  const fillLetter = /^Fill\s+([A-D])$/i.exec(name)
  if (fillLetter) {
    const L = fillLetter[1].toUpperCase()
    return `Fill In ${L}${L}`
  }
  const fillIn = /^Fill In\s+([A-D]{1,2})$/i.exec(name)
  if (fillIn) return `Fill In ${fillIn[1].toUpperCase()}`

  return name
}

/**
 * Map a Yamaha MIDI marker to the desktop Style Maker section display name.
 * Intro A→Intro 1, Ending B→Ending 2, Fill In AA→Fill A.
 */
export function displaySectionNameFromMarker(marker: string): string {
  const name = marker.trim().replace(/^fn:/i, "").trim()
  if (!name) return name

  const intro = /^Intro\s+([A-D])$/i.exec(name)
  if (intro) {
    const idx = indexForLetter(intro[1])
    return idx != null ? `Intro ${idx + 1}` : name
  }
  const ending = /^Ending\s+([A-D])$/i.exec(name)
  if (ending) {
    const idx = indexForLetter(ending[1])
    return idx != null ? `Ending ${idx + 1}` : name
  }
  const fillIn = /^Fill In\s+([A-D])\1$/i.exec(name)
  if (fillIn) return `Fill ${fillIn[1].toUpperCase()}`

  if (/^Main\s+[A-D]$/i.test(name)) {
    return `Main ${name.slice(-1).toUpperCase()}`
  }

  return name
}
