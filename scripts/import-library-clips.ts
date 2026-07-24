/**
 * Import bass/drums/guitar clips from the desktop plaintext smartbridge.db
 * (midi_clips table) into hosted Postgres library_clips.
 *
 * Mirrors AGENTS.md library rebuild practice: re-run after every desktop
 * library rebuild so Style Maker stays in sync with midi_clips.
 *
 * Usage:
 *   SMARTBRIDGE_DB_PATH=... DATABASE_URL=... npm run db:import-library
 */
import Database from "better-sqlite3"
import { sql } from "drizzle-orm"
import { requireDb } from "../lib/db"
import { libraryClips } from "../lib/db/schema"

const SOURCE_KINDS = ["bass", "drums", "guitar"] as const

type SourceRow = {
  id: number
  source_kind: string
  source_library: string | null
  category_name: string | null
  subcategory_name: string | null
  song_name: string | null
  clip_name: string | null
  library_name: string | null
  feel_name: string | null
  feel_mode: string | null
  time_signature: string | null
  bpm: number | null
  bpm_bucket: string | null
  section_type: string | null
  style_tags: string | null
  variation: number | null
  midi_path: string
  note_count: number | null
  note_lo: number | null
  note_hi: number | null
  bars: number | null
  midi_data: Buffer
}

async function main() {
  const dbPath = process.env.SMARTBRIDGE_DB_PATH
  if (!dbPath) {
    throw new Error("SMARTBRIDGE_DB_PATH is required (path to plaintext smartbridge.db).")
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.")
  }

  const sqlite = new Database(dbPath, { readonly: true })
  const rows = sqlite
    .prepare(
      `SELECT c.id, c.source_kind, c.source_library, c.category_name, c.subcategory_name,
              c.song_name, c.clip_name, c.library_name, c.feel_name, c.feel_mode,
              c.time_signature, c.bpm, c.bpm_bucket, c.section_type, c.style_tags,
              c.variation, c.midi_path, c.note_count, c.note_lo, c.note_hi, c.midi_data,
              a.bars AS bars
         FROM midi_clips c
         LEFT JOIN midi_clip_analysis a ON a.clip_id = c.id
        WHERE c.source_kind IN ('bass', 'drums', 'guitar')
          AND c.midi_data IS NOT NULL`,
    )
    .all() as SourceRow[]

  console.log(`Read ${rows.length} clips from ${dbPath}`)

  const db = requireDb()
  const batchSize = 100
  let upserted = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((row) => ({
      id: row.id,
      sourceKind: row.source_kind,
      sourceLibrary: row.source_library,
      categoryName: row.category_name,
      subcategoryName: row.subcategory_name,
      songName: row.song_name,
      clipName: row.clip_name,
      libraryName: row.library_name,
      feelName: row.feel_name,
      feelMode: row.feel_mode,
      timeSignature: row.time_signature,
      bpm: row.bpm,
      bpmBucket: row.bpm_bucket,
      sectionType: row.section_type,
      styleTags: row.style_tags || "[]",
      variation: row.variation || 0,
      midiPath: row.midi_path,
      noteCount: row.note_count || 0,
      noteLo: row.note_lo,
      noteHi: row.note_hi,
      bars:
        row.bars != null && Number.isFinite(Number(row.bars))
          ? Math.max(1, Math.round(Number(row.bars)))
          : null,
      midiData: row.midi_data,
      updatedAt: new Date(),
    }))

    await db
      .insert(libraryClips)
      .values(batch)
      .onConflictDoUpdate({
        target: libraryClips.id,
        set: {
          sourceKind: sql`excluded.source_kind`,
          sourceLibrary: sql`excluded.source_library`,
          categoryName: sql`excluded.category_name`,
          subcategoryName: sql`excluded.subcategory_name`,
          songName: sql`excluded.song_name`,
          clipName: sql`excluded.clip_name`,
          libraryName: sql`excluded.library_name`,
          feelName: sql`excluded.feel_name`,
          feelMode: sql`excluded.feel_mode`,
          timeSignature: sql`excluded.time_signature`,
          bpm: sql`excluded.bpm`,
          bpmBucket: sql`excluded.bpm_bucket`,
          sectionType: sql`excluded.section_type`,
          styleTags: sql`excluded.style_tags`,
          variation: sql`excluded.variation`,
          midiPath: sql`excluded.midi_path`,
          noteCount: sql`excluded.note_count`,
          noteLo: sql`excluded.note_lo`,
          noteHi: sql`excluded.note_hi`,
          bars: sql`excluded.bars`,
          midiData: sql`excluded.midi_data`,
          updatedAt: sql`excluded.updated_at`,
        },
      })

    upserted += batch.length
    console.log(`Upserted ${upserted}/${rows.length}`)
  }

  for (const kind of SOURCE_KINDS) {
    const count = rows.filter((r) => r.source_kind === kind).length
    console.log(`  ${kind}: ${count}`)
  }

  sqlite.close()
  console.log("Done.")
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
