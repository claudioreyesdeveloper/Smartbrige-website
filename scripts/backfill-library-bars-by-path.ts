/**
 * Fill library_clips.bars for rows whose desktop id drifted, matching midi_path.
 */
import Database from "better-sqlite3"
import postgres from "postgres"

async function main() {
  const dbPath = process.env.SMARTBRIDGE_DB_PATH
  const databaseUrl = process.env.DATABASE_URL
  if (!dbPath) throw new Error("SMARTBRIDGE_DB_PATH is required")
  if (!databaseUrl) throw new Error("DATABASE_URL is required")

  const sqlite = new Database(dbPath, { readonly: true })
  const rows = sqlite
    .prepare(
      `SELECT c.midi_path AS midi_path, a.bars AS bars
         FROM midi_clips c
         JOIN midi_clip_analysis a ON a.clip_id = c.id
        WHERE c.source_kind IN ('bass', 'drums', 'guitar')
          AND a.bars IS NOT NULL`,
    )
    .all() as { midi_path: string; bars: number }[]
  sqlite.close()

  const byPath = new Map(
    rows.map((row) => [
      row.midi_path,
      Math.max(1, Math.round(Number(row.bars))),
    ]),
  )

  const sql = postgres(databaseUrl, { max: 1 })
  const pending = await sql`
    SELECT id, midi_path FROM library_clips
     WHERE bars IS NULL
       AND source_kind IN ('bass', 'drums', 'guitar')
  `

  let updated = 0
  let unmatched = 0
  for (let i = 0; i < pending.length; i++) {
    const row = pending[i]!
    const bars = byPath.get(row.midi_path)
    if (bars == null) {
      unmatched++
      continue
    }
    await sql`
      UPDATE library_clips SET bars = ${bars}, updated_at = now()
       WHERE id = ${row.id}
    `
    updated++
    if ((i + 1) % 500 === 0) console.log(`progress ${i + 1}/${pending.length}`)
  }

  const sample = await sql`
    SELECT source_kind,
           count(*)::int AS n,
           count(bars)::int AS with_bars
      FROM library_clips
     WHERE source_kind IN ('bass', 'drums')
     GROUP BY 1
     ORDER BY 1
  `
  console.log({ pending: pending.length, updated, unmatched, sample })
  await sql.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
