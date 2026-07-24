/**
 * Local library access for `next dev` without Postgres.
 * Reads bass/drums/guitar clips directly from the desktop plaintext smartbridge.db
 * (midi_clips), matching the hosted library_clips schema fields.
 *
 * Filter semantics aligned with MidiLibraryRepository / LibraryPhrasePicker:
 * - feelMode → feel_mode (straight/swing)
 * - sectionType: drums exact match; others match section_type OR 'main'
 * - excludeFillSections: drums exclude fill_ins (and legacy *fill* names)
 */
import Database from "better-sqlite3"
import { existsSync } from "fs"
import {
  filterDrumLibraryCategories,
  isExcludedDrumLibraryCategory,
} from "@/lib/style-maker/drum-library-categories"

export type LocalClipMeta = {
  id: number
  sourceKind: string
  categoryName: string | null
  subcategoryName: string | null
  clipName: string | null
  feelName: string | null
  feelMode: string | null
  bpm: number | null
  sectionType: string | null
  styleTags: string
  noteCount: number
  variation: number
  /** From midi_clip_analysis.bars (rounded for UI). */
  bars: number | null
}

function dbPath(): string | null {
  const path =
    process.env.SMARTBRIDGE_DB_PATH ||
    "/Users/claudio/Developer/Smartbridge/SmartBridge/Resources/smartbridge.db"
  return existsSync(path) ? path : null
}

export function localLibraryAvailable(): boolean {
  return !process.env.DATABASE_URL && Boolean(dbPath())
}

export function browseLocalClips(options: {
  sourceKind: string
  category?: string | null
  feel?: string | null
  feelMode?: string | null
  sectionType?: string | null
  q?: string | null
  bpmMin?: number | null
  bpmMax?: number | null
  excludeFillSections?: boolean
  limit: number
  offset: number
}): { clips: LocalClipMeta[]; total: number } {
  const path = dbPath()
  if (!path) throw new Error("Local smartbridge.db not found.")

  if (
    options.sourceKind === "drums" &&
    options.category &&
    isExcludedDrumLibraryCategory(options.category)
  ) {
    return { clips: [], total: 0 }
  }

  const sqlite = new Database(path, { readonly: true })
  try {
    const where: string[] = [
      "c.source_kind = ?",
      "c.midi_data IS NOT NULL",
    ]
    const params: (string | number)[] = [options.sourceKind]

    if (options.category) {
      where.push("c.category_name = ?")
      params.push(options.category)
    } else if (options.sourceKind === "drums") {
      // Hide cinematic / percussion packs from “All Genres”
      where.push(
        `(c.category_name IS NULL OR (
          instr(lower(c.category_name), 'percussion') = 0
          AND instr(lower(c.category_name), 'cinematic') = 0
          AND instr(lower(replace(replace(c.category_name, ' ', '_'), '-', '_')), 'action') = 0
        ))`,
      )
    }
    if (options.feelMode) {
      where.push("lower(coalesce(c.feel_mode, '')) = lower(?)")
      params.push(options.feelMode)
    } else if (options.feel) {
      where.push("c.feel_name = ?")
      params.push(options.feel)
    }
    if (options.sectionType) {
      if (options.sourceKind === "drums") {
        where.push("c.section_type = ?")
      } else {
        // MidiLibraryRepository::queryClips — section match OR main
        where.push("(c.section_type = ? OR c.section_type = 'main')")
      }
      params.push(options.sectionType)
    }
    if (options.excludeFillSections) {
      where.push(
        "(c.section_type IS NULL OR (lower(c.section_type) <> 'fill_ins' AND lower(c.section_type) NOT LIKE '%fill%'))",
      )
    }
    if (options.q) {
      where.push("c.clip_name LIKE ?")
      params.push(`%${options.q}%`)
    }
    if (options.bpmMin != null) {
      where.push("c.bpm >= ?")
      params.push(options.bpmMin)
    }
    if (options.bpmMax != null) {
      where.push("c.bpm <= ?")
      params.push(options.bpmMax)
    }

    const whereSql = where.join(" AND ")
    const total = (
      sqlite
        .prepare(`SELECT count(*) AS n FROM midi_clips c WHERE ${whereSql}`)
        .get(...params) as { n: number }
    ).n

    const rows = sqlite
      .prepare(
        `SELECT c.id AS id, c.source_kind AS sourceKind,
                c.category_name AS categoryName,
                c.subcategory_name AS subcategoryName, c.clip_name AS clipName,
                c.feel_name AS feelName, c.feel_mode AS feelMode, c.bpm AS bpm,
                c.section_type AS sectionType, c.style_tags AS styleTags,
                c.note_count AS noteCount, c.variation AS variation,
                a.bars AS bars
           FROM midi_clips c
           LEFT JOIN midi_clip_analysis a ON a.clip_id = c.id
          WHERE ${whereSql}
          ORDER BY c.category_name, c.clip_name
          LIMIT ? OFFSET ?`,
      )
      .all(...params, options.limit, options.offset) as LocalClipMeta[]

    return {
      clips: rows.map((row) => ({
        ...row,
        bars:
          row.bars != null && Number.isFinite(Number(row.bars))
            ? Math.max(1, Math.round(Number(row.bars)))
            : null,
      })),
      total,
    }
  } finally {
    sqlite.close()
  }
}

export function fetchLocalClipMidi(id: number): {
  midiData: Buffer
  clipName: string | null
  sourceKind: string
} | null {
  const path = dbPath()
  if (!path) return null
  const sqlite = new Database(path, { readonly: true })
  try {
    const row = sqlite
      .prepare(
        `SELECT midi_data AS midiData, clip_name AS clipName, source_kind AS sourceKind
           FROM midi_clips WHERE id = ? AND midi_data IS NOT NULL`,
      )
      .get(id) as
      | { midiData: Buffer; clipName: string | null; sourceKind: string }
      | undefined
    return row || null
  } finally {
    sqlite.close()
  }
}

export function localFacets(
  sourceKind: string,
  options?: { category?: string | null },
): {
  categories: string[]
  feels: string[]
  sections: string[]
} {
  const path = dbPath()
  if (!path) return { categories: [], feels: [], sections: [] }
  const sqlite = new Database(path, { readonly: true })
  try {
    const categories = (
      sqlite
        .prepare(
          `SELECT DISTINCT category_name AS v FROM midi_clips
            WHERE source_kind = ? AND category_name IS NOT NULL
              AND TRIM(category_name) <> ''
            ORDER BY category_name`,
        )
        .all(sourceKind) as { v: string }[]
    ).map((r) => r.v)

    const feels = (
      sqlite
        .prepare(
          `SELECT DISTINCT feel_mode AS v FROM midi_clips
            WHERE source_kind = ? AND feel_mode IS NOT NULL
              AND TRIM(feel_mode) <> ''
            ORDER BY feel_mode`,
        )
        .all(sourceKind) as { v: string }[]
    ).map((r) => r.v)

    // Desktop getDrumSectionTypesForCategory — scope by genre when provided
    let sections: string[]
    if (options?.category) {
      sections = (
        sqlite
          .prepare(
            `SELECT DISTINCT section_type AS v FROM midi_clips
              WHERE source_kind = ? AND category_name = ?
                AND section_type IS NOT NULL AND TRIM(section_type) <> ''
              ORDER BY section_type`,
          )
          .all(sourceKind, options.category) as { v: string }[]
      ).map((r) => r.v)
    } else {
      sections = (
        sqlite
          .prepare(
            `SELECT DISTINCT section_type AS v FROM midi_clips
              WHERE source_kind = ? AND section_type IS NOT NULL
                AND TRIM(section_type) <> ''
              ORDER BY section_type`,
          )
          .all(sourceKind) as { v: string }[]
      ).map((r) => r.v)
    }

    return {
      categories:
        sourceKind === "drums"
          ? filterDrumLibraryCategories(categories)
          : categories,
      feels,
      sections,
    }
  } finally {
    sqlite.close()
  }
}
