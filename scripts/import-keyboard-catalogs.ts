/**
 * Import keyboard_models / keyboard_voices / keyboard_styles from the desktop
 * plaintext smartbridge.db into hosted Postgres (Neon).
 *
 * Usage:
 *   SMARTBRIDGE_DB_PATH=... DATABASE_URL=... npm run db:import-keyboards
 */
import Database from "better-sqlite3"
import { sql } from "drizzle-orm"
import { requireDb } from "../lib/db"
import {
  keyboardModels,
  keyboardStyles,
  keyboardVoices,
} from "../lib/db/schema"

type ModelRow = {
  id: number
  model_key: string
  display_name: string
  source_file: string
  is_active: number
  created_at: string | null
}

type VoiceRow = {
  id: number
  model_id: number
  msb: number
  lsb: number
  pc0: number
  prg: number
  name: string
  category: string | null
  sub_category: string | null
  display_order: number
}

type StyleRow = {
  id: number
  model_id: number
  style_number: number
  name: string
  category: string | null
  display_order: number
}

async function upsertBatches<T>(
  label: string,
  rows: T[],
  batchSize: number,
  write: (batch: T[]) => Promise<void>,
) {
  let done = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    await write(batch)
    done += batch.length
    console.log(`  ${label}: ${done}/${rows.length}`)
  }
}

async function main() {
  const dbPath = process.env.SMARTBRIDGE_DB_PATH
  if (!dbPath) {
    throw new Error("SMARTBRIDGE_DB_PATH is required (plaintext smartbridge.db).")
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.")
  }

  const sqlite = new Database(dbPath, { readonly: true })
  const models = sqlite
    .prepare(
      `SELECT id, model_key, display_name, source_file, is_active, created_at
         FROM keyboard_models
        ORDER BY id`,
    )
    .all() as ModelRow[]
  const voices = sqlite
    .prepare(
      `SELECT id, model_id, msb, lsb, pc0, prg, name, category, sub_category, display_order
         FROM keyboard_voices
        ORDER BY id`,
    )
    .all() as VoiceRow[]
  const styles = sqlite
    .prepare(
      `SELECT id, model_id, style_number, name, category, display_order
         FROM keyboard_styles
        ORDER BY id`,
    )
    .all() as StyleRow[]

  console.log(
    `Read models=${models.length} voices=${voices.length} styles=${styles.length} from ${dbPath}`,
  )

  const db = requireDb()

  await upsertBatches("models", models, 50, async (batch) => {
    await db
      .insert(keyboardModels)
      .values(
        batch.map((row) => ({
          id: row.id,
          modelKey: row.model_key,
          displayName: row.display_name,
          sourceFile: row.source_file || "",
          isActive: row.is_active ? 1 : 0,
          createdAt: row.created_at ? new Date(row.created_at + "Z") : new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: keyboardModels.id,
        set: {
          modelKey: sql`excluded.model_key`,
          displayName: sql`excluded.display_name`,
          sourceFile: sql`excluded.source_file`,
          isActive: sql`excluded.is_active`,
        },
      })
  })

  await upsertBatches("voices", voices, 250, async (batch) => {
    await db
      .insert(keyboardVoices)
      .values(
        batch.map((row) => ({
          id: row.id,
          modelId: row.model_id,
          msb: row.msb,
          lsb: row.lsb,
          pc0: row.pc0,
          prg: row.prg,
          name: row.name,
          category: row.category,
          subCategory: row.sub_category,
          displayOrder: row.display_order,
        })),
      )
      .onConflictDoUpdate({
        target: keyboardVoices.id,
        set: {
          modelId: sql`excluded.model_id`,
          msb: sql`excluded.msb`,
          lsb: sql`excluded.lsb`,
          pc0: sql`excluded.pc0`,
          prg: sql`excluded.prg`,
          name: sql`excluded.name`,
          category: sql`excluded.category`,
          subCategory: sql`excluded.sub_category`,
          displayOrder: sql`excluded.display_order`,
        },
      })
  })

  await upsertBatches("styles", styles, 250, async (batch) => {
    await db
      .insert(keyboardStyles)
      .values(
        batch.map((row) => ({
          id: row.id,
          modelId: row.model_id,
          styleNumber: row.style_number,
          name: row.name,
          category: row.category,
          displayOrder: row.display_order,
        })),
      )
      .onConflictDoUpdate({
        target: keyboardStyles.id,
        set: {
          modelId: sql`excluded.model_id`,
          styleNumber: sql`excluded.style_number`,
          name: sql`excluded.name`,
          category: sql`excluded.category`,
          displayOrder: sql`excluded.display_order`,
        },
      })
  })

  sqlite.close()
  console.log("Done.")
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
