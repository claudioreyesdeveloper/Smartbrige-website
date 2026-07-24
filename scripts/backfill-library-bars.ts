/**
 * One-shot: copy midi_clip_analysis.bars into hosted library_clips.bars by id.
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
      `SELECT c.id AS id, a.bars AS bars
         FROM midi_clips c
         LEFT JOIN midi_clip_analysis a ON a.clip_id = c.id
        WHERE c.source_kind IN ('bass', 'drums', 'guitar')`,
    )
    .all() as { id: number; bars: number | null }[]
  sqlite.close()

  const sql = postgres(databaseUrl, { max: 1 })
  let updated = 0
  let missing = 0
  let nullBars = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const bars =
      row.bars != null && Number.isFinite(Number(row.bars))
        ? Math.max(1, Math.round(Number(row.bars)))
        : null
    if (bars == null) nullBars++
    const result = await sql`
      UPDATE library_clips SET bars = ${bars}, updated_at = now()
       WHERE id = ${row.id}
    `
    if (result.count === 0) missing++
    else updated += result.count
    if ((i + 1) % 1000 === 0 || i + 1 === rows.length) {
      console.log(`progress ${i + 1}/${rows.length}`)
    }
  }

  const sample = await sql`
    SELECT source_kind,
           count(*)::int AS n,
           count(bars)::int AS with_bars,
           round(avg(bars)::numeric, 1) AS avg_bars
      FROM library_clips
     WHERE source_kind IN ('bass', 'drums')
     GROUP BY 1
     ORDER BY 1
  `
  console.log({ updated, missing, nullBars, total: rows.length, sample })
  await sql.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
