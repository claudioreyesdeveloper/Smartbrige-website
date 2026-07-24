/**
 * Local keyboard_styles browse — model-scoped factory style catalog
 * from desktop smartbridge.db (same snapshot as keyboard_voices).
 */

import Database from "better-sqlite3"
import { existsSync } from "fs"
import type { StyleCatalogEntry } from "@/lib/demo/types"
import {
  dbModelKey,
  type DbModelKey,
} from "@/lib/demo/yamaha/keyboard-models"

function dbPath(): string | null {
  const path =
    process.env.SMARTBRIDGE_DB_PATH ||
    "/Users/claudio/Developer/Smartbridge/SmartBridge/Resources/smartbridge.db"
  return existsSync(path) ? path : null
}

export function localStylesAvailable(): boolean {
  return Boolean(dbPath())
}

function resolveModelId(
  sqlite: InstanceType<typeof Database>,
  modelKey: string | null | undefined,
): number | null {
  const key = dbModelKey(modelKey)
  if (key) {
    const row = sqlite
      .prepare(`SELECT id FROM keyboard_models WHERE model_key = ? LIMIT 1`)
      .get(key) as { id: number } | undefined
    if (row) return row.id
  }
  const active = sqlite
    .prepare(
      `SELECT id FROM keyboard_models WHERE is_active = 1 ORDER BY id LIMIT 1`,
    )
    .get() as { id: number } | undefined
  return active?.id ?? null
}

export function listLocalStyleCategories(modelKey?: string | null): string[] {
  const path = dbPath()
  if (!path) return []
  const sqlite = new Database(path, { readonly: true })
  try {
    const modelId = resolveModelId(sqlite, modelKey)
    if (modelId == null) return []
    const rows = sqlite
      .prepare(
        `SELECT DISTINCT category FROM keyboard_styles
         WHERE model_id = ? AND category IS NOT NULL AND trim(category) != ''
         ORDER BY category COLLATE NOCASE`,
      )
      .all(modelId) as { category: string }[]
    return rows.map((r) => r.category)
  } finally {
    sqlite.close()
  }
}

export function listLocalStyles(
  modelKey?: string | null,
): StyleCatalogEntry[] {
  const path = dbPath()
  if (!path) return []
  const sqlite = new Database(path, { readonly: true })
  try {
    const modelId = resolveModelId(sqlite, modelKey)
    if (modelId == null) return []
    const rows = sqlite
      .prepare(
        `SELECT style_number AS styleNumber, name, category
         FROM keyboard_styles
         WHERE model_id = ?
         ORDER BY display_order, name COLLATE NOCASE`,
      )
      .all(modelId) as {
      styleNumber: number
      name: string
      category: string | null
    }[]
    return rows.map((r) => ({
      name: r.name,
      category: r.category || "Other",
      styleNumber: r.styleNumber,
      bpm: 0,
    }))
  } finally {
    sqlite.close()
  }
}

export function listLocalKeyboardModels(): {
  modelKey: DbModelKey
  displayName: string
}[] {
  const path = dbPath()
  if (!path) return []
  const sqlite = new Database(path, { readonly: true })
  try {
    const rows = sqlite
      .prepare(
        `SELECT model_key AS modelKey, display_name AS displayName
         FROM keyboard_models
         ORDER BY display_name COLLATE NOCASE`,
      )
      .all() as { modelKey: string; displayName: string }[]
    return rows
      .map((r) => ({
        modelKey: dbModelKey(r.modelKey) as DbModelKey,
        displayName: r.displayName,
      }))
      .filter((r) => r.modelKey)
  } finally {
    sqlite.close()
  }
}
