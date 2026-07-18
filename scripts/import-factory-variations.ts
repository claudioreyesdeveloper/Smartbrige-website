/**
 * Import desktop factory_clip_variations into the active Neon jam catalog version.
 * Chord timings only (no MIDI blob upload) — matches Jam Player reharm styles.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/import-factory-variations.ts \
 *     [/path/to/smartbridge.db] [catalogVersionId]
 */
import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { neon } from "@neondatabase/serverless"

const DEFAULT_DB =
  "/Users/claudio/Developer/Smartbridge/SmartBridge/Resources/smartbridge.db"
const DEFAULT_VERSION = "6a1c0c69-ede5-4f17-9899-981740af200a"
const BATCH = 200

type DesktopRow = {
  clip_id: number
  variation_index: number
  source_name: string | null
  chord_timings_json: string | null
  created_at: number | null
  song_id: string
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is required")

  const desktopDb = process.argv[2] || DEFAULT_DB
  const versionId = process.argv[3] || DEFAULT_VERSION
  const sql = neon(databaseUrl)

  process.stdout.write(`Reading variations from ${desktopDb}…\n`)
  const raw = execFileSync(
    "sqlite3",
    [
      "-json",
      desktopDb,
      `SELECT v.clip_id, v.variation_index, v.source_name, v.chord_timings_json, v.created_at, c.song_id
       FROM factory_clip_variations v
       JOIN factory_clips c ON c.id = v.clip_id
       ORDER BY v.clip_id, v.variation_index`,
    ],
    { maxBuffer: 512 * 1024 * 1024, encoding: "utf8" },
  )
  const rows = JSON.parse(raw) as DesktopRow[]
  process.stdout.write(`Loaded ${rows.length} desktop variations\n`)

  // Map clip_id → song_stable_id from Neon clips (authoritative linkage).
  const clipRows = await sql`
    SELECT stable_id, metadata->>'song_stable_id' AS song_stable_id
    FROM catalog_entries
    WHERE catalog_version_id = ${versionId}
      AND kind = 'factory_clip'
  `
  const songByClip = new Map<string, string>()
  for (const clip of clipRows) {
    if (clip.stable_id && clip.song_stable_id) {
      songByClip.set(String(clip.stable_id), String(clip.song_stable_id))
    }
  }
  process.stdout.write(`Neon clips available: ${songByClip.size}\n`)

  const existing = await sql`
    SELECT stable_id FROM catalog_entries
    WHERE catalog_version_id = ${versionId}
      AND kind = 'factory_clip_variation'
  `
  const have = new Set(existing.map((r) => String(r.stable_id)))
  process.stdout.write(`Already imported: ${have.size}\n`)

  const pending: Array<{
    id: string
    stableId: string
    metadata: Record<string, unknown>
  }> = []

  for (const row of rows) {
    const clipStableId = `factory_clip:${row.clip_id}`
    const songStableId =
      songByClip.get(clipStableId) || `factory_song:${row.song_id}`
    const stableId = `factory_clip_variation:${row.clip_id}:${row.variation_index}`
    if (have.has(stableId)) continue
    if (!songByClip.has(clipStableId)) continue

    pending.push({
      id: randomUUID(),
      stableId,
      metadata: {
        stable_id: stableId,
        clip_stable_id: clipStableId,
        song_stable_id: songStableId,
        asset: null,
        variation: {
          clip_id: row.clip_id,
          variation_index: row.variation_index,
          source_name: row.source_name,
          chord_timings_json: row.chord_timings_json,
          created_at: row.created_at,
        },
      },
    })
  }

  process.stdout.write(`Inserting ${pending.length} variations…\n`)
  let inserted = 0
  for (let i = 0; i < pending.length; i += BATCH) {
    const chunk = pending.slice(i, i + BATCH)
    const now = new Date().toISOString()
    // Multi-row insert via unnest
    const ids = chunk.map((r) => r.id)
    const stableIds = chunk.map((r) => r.stableId)
    const metadatas = chunk.map((r) => JSON.stringify(r.metadata))
    await sql`
      INSERT INTO catalog_entries (
        id, catalog_version_id, section, stable_id, service_key, kind, metadata, blob_reference_id, created_at
      )
      SELECT
        u.id,
        ${versionId},
        'factory_songs',
        u.stable_id,
        'jam-player',
        'factory_clip_variation',
        u.metadata::jsonb,
        NULL,
        ${now}::timestamptz
      FROM unnest(
        ${ids}::text[],
        ${stableIds}::text[],
        ${metadatas}::text[]
      ) AS u(id, stable_id, metadata)
      ON CONFLICT DO NOTHING
    `
    inserted += chunk.length
    process.stdout.write(`  ${inserted}/${pending.length}\n`)
  }

  // Refresh variation_count on clips
  process.stdout.write("Updating clip variation_count…\n")
  await sql`
    UPDATE catalog_entries AS clips
    SET metadata = jsonb_set(
      clips.metadata,
      '{variation_count}',
      to_jsonb(COALESCE(counts.n, 0)),
      true
    )
    FROM (
      SELECT metadata->>'clip_stable_id' AS clip_stable_id, count(*)::int AS n
      FROM catalog_entries
      WHERE catalog_version_id = ${versionId}
        AND kind = 'factory_clip_variation'
      GROUP BY 1
    ) AS counts
    WHERE clips.catalog_version_id = ${versionId}
      AND clips.kind = 'factory_clip'
      AND clips.stable_id = counts.clip_stable_id
  `

  const final = await sql`
    SELECT count(*)::int AS n FROM catalog_entries
    WHERE catalog_version_id = ${versionId}
      AND kind = 'factory_clip_variation'
  `
  const names = await sql`
    SELECT metadata->'variation'->>'source_name' AS source_name, count(*)::int AS n
    FROM catalog_entries
    WHERE catalog_version_id = ${versionId}
      AND kind = 'factory_clip_variation'
    GROUP BY 1
    ORDER BY n DESC
  `
  process.stdout.write(
    `${JSON.stringify({ variationRows: final[0]?.n, bySource: names }, null, 2)}\n`,
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
