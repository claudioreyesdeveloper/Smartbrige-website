/**
 * Local keyboard_voices browse — same plaintext smartbridge.db as local-library.
 * Scoped by connected keyboard model (desktop VoiceSearchDialog / keyboard_models).
 */

import Database from "better-sqlite3"
import { existsSync } from "fs"
import { dbModelKey } from "@/lib/demo/yamaha/keyboard-models"

export type LocalKeyboardVoice = {
  id: number
  msb: number
  lsb: number
  /** Yamaha program 1–128 */
  programYamaha: number
  name: string
  category: string | null
  subCategory: string | null
}

function dbPath(): string | null {
  const path =
    process.env.SMARTBRIDGE_DB_PATH ||
    "/Users/claudio/Developer/Smartbridge/SmartBridge/Resources/smartbridge.db"
  return existsSync(path) ? path : null
}

export function localVoicesAvailable(): boolean {
  return Boolean(dbPath())
}

function resolveModelId(
  sqlite: InstanceType<typeof Database>,
  modelKey?: string | null,
): number {
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
  return active?.id ?? 4 // genos2
}

export function listLocalVoiceCategories(modelKey?: string | null): string[] {
  const path = dbPath()
  if (!path) return []
  const sqlite = new Database(path, { readonly: true })
  try {
    const modelId = resolveModelId(sqlite, modelKey)
    const rows = sqlite
      .prepare(
        `SELECT DISTINCT category FROM keyboard_voices
         WHERE model_id = ? AND category IS NOT NULL AND trim(category) != ''
         ORDER BY category COLLATE NOCASE`,
      )
      .all(modelId) as { category: string }[]
    return rows.map((r) => r.category)
  } finally {
    sqlite.close()
  }
}

export function searchLocalVoices(options: {
  q?: string | null
  category?: string | null
  limit?: number
  modelKey?: string | null
}): LocalKeyboardVoice[] {
  const path = dbPath()
  if (!path) return []
  const limit = Math.min(200, Math.max(1, options.limit ?? 80))
  const sqlite = new Database(path, { readonly: true })
  try {
    const modelId = resolveModelId(sqlite, options.modelKey)
    const where = ["model_id = ?"]
    const params: (string | number)[] = [modelId]
    if (options.category?.trim()) {
      where.push("category = ?")
      params.push(options.category.trim())
    }
    if (options.q?.trim()) {
      where.push("name LIKE ? COLLATE NOCASE")
      params.push(`%${options.q.trim()}%`)
    }
    params.push(limit)
    const rows = sqlite
      .prepare(
        `SELECT id, msb, lsb, prg, name, category, sub_category
         FROM keyboard_voices
         WHERE ${where.join(" AND ")}
         ORDER BY display_order, name COLLATE NOCASE
         LIMIT ?`,
      )
      .all(...params) as {
      id: number
      msb: number
      lsb: number
      prg: number
      name: string
      category: string | null
      sub_category: string | null
    }[]
    return rows.map((r) => ({
      id: r.id,
      msb: r.msb,
      lsb: r.lsb,
      programYamaha: r.prg,
      name: r.name,
      category: r.category,
      subCategory: r.sub_category,
    }))
  } finally {
    sqlite.close()
  }
}

/** Desktop DatabaseManager::findVoiceByMsbLsbPrg for a keyboard model. */
export function findLocalVoiceByMsbLsbPrg(
  msb: number,
  lsb: number,
  programYamaha: number,
  modelKey?: string | null,
): LocalKeyboardVoice | null {
  const path = dbPath()
  if (!path) return null
  const sqlite = new Database(path, { readonly: true })
  try {
    const modelId = resolveModelId(sqlite, modelKey)
    const row = sqlite
      .prepare(
        `SELECT id, msb, lsb, prg, name, category, sub_category
         FROM keyboard_voices
         WHERE model_id = ? AND msb = ? AND lsb = ? AND prg = ?
         LIMIT 1`,
      )
      .get(modelId, msb, lsb, programYamaha) as
      | {
          id: number
          msb: number
          lsb: number
          prg: number
          name: string
          category: string | null
          sub_category: string | null
        }
      | undefined
    if (!row) return null
    return {
      id: row.id,
      msb: row.msb,
      lsb: row.lsb,
      programYamaha: row.prg,
      name: row.name,
      category: row.category,
      subCategory: row.sub_category,
    }
  } finally {
    sqlite.close()
  }
}

export type VoiceBankProgramKey = {
  msb: number
  lsb: number
  programYamaha: number
}

export function voiceBankProgramKey(voice: VoiceBankProgramKey): string {
  return `${voice.msb}:${voice.lsb}:${voice.programYamaha}`
}

/** Batch resolve — same keyboard_voices rows as findVoiceByMsbLsbPrg. */
export type AuditionVoiceFamily = "bass" | "guitar" | "drums" | "brass"

export type LocalAuditionVoiceChoice = {
  id: string
  label: string
  msb: number
  lsb: number
  programYamaha: number
  group: string
}

function auditionFamilyWhere(
  family: AuditionVoiceFamily,
  mode: "preferred" | "fallback",
): string {
  const mega = `lower(IFNULL(category, '')) IN ('megavoice', 'megavoices')`
  switch (family) {
    case "drums":
      if (mode === "preferred") {
        return `(lower(IFNULL(category, '')) = 'drumkit'
                OR lower(IFNULL(sub_category, '')) = 'drumkit')`
      }
      return `(
        lower(IFNULL(category, '')) IN ('perc&drum', 'percussion')
        OR lower(IFNULL(sub_category, '')) IN ('drums', 'percussion')
      )`
    case "bass":
      if (mode === "preferred") {
        return `((${mega} AND lower(IFNULL(sub_category, '')) = 'bass')
                OR (lower(IFNULL(category, '')) = 'bass' AND msb = 8))`
      }
      return `(
        lower(IFNULL(category, '')) = 'bass'
        OR (lower(IFNULL(category, '')) IN ('guitar&bass', 'guitar & bass')
            AND lower(IFNULL(sub_category, '')) = 'bass')
      )`
    case "guitar":
      if (mode === "preferred") {
        return `((${mega} AND lower(IFNULL(sub_category, '')) IN ('a.guitar', 'e.guitar'))
                OR (lower(IFNULL(category, '')) IN ('a.guitar', 'e.guitar') AND msb = 8))`
      }
      return `(
        lower(IFNULL(category, '')) IN ('a.guitar', 'e.guitar')
        OR (lower(IFNULL(category, '')) IN ('guitar&bass', 'guitar & bass')
            AND lower(IFNULL(sub_category, '')) IN ('a.guitar', 'e.guitar', 'guitar'))
      )`
    case "brass":
      if (mode === "preferred") {
        return `(${mega} AND lower(IFNULL(sub_category, '')) = 'brass')`
      }
      return `lower(IFNULL(category, '')) = 'brass'`
  }
}

function auditionGroup(
  family: AuditionVoiceFamily,
  category: string | null,
  subCategory: string | null,
): string {
  const sub = (subCategory || "").toLowerCase()
  const cat = (category || "").toLowerCase()
  if (family === "guitar") {
    if (sub.includes("a.guitar") || cat === "a.guitar") return "Acoustic"
    if (sub.includes("e.guitar") || cat === "e.guitar") return "Electric"
    return "Guitar"
  }
  if (family === "drums") {
    return cat === "legacy" ? "Legacy" : "DrumKit"
  }
  if (family === "brass") return "Brass"
  return "MegaVoice Bass"
}

function auditionChoiceId(name: string, msb: number, lsb: number, prg: number): string {
  const cleaned = name.replace(/\s+/g, "").trim()
  return cleaned || `${msb}:${lsb}:${prg}`
}

/** Model-scoped MegaVoice / DrumKit rows for Style Maker audition comboboxes. */
export function listLocalAuditionVoices(
  modelKey: string | null | undefined,
  family: AuditionVoiceFamily,
  limit = 300,
): LocalAuditionVoiceChoice[] {
  const path = dbPath()
  if (!path) return []
  const sqlite = new Database(path, { readonly: true })
  try {
    const modelId = resolveModelId(sqlite, modelKey)
    const capped = Math.min(400, Math.max(1, limit))
    const load = (mode: "preferred" | "fallback") =>
      sqlite
        .prepare(
          `SELECT name, msb, lsb, prg, category, sub_category
           FROM keyboard_voices
           WHERE model_id = ? AND ${auditionFamilyWhere(family, mode)}
           ORDER BY display_order, name COLLATE NOCASE
           LIMIT ?`,
        )
        .all(modelId, capped) as {
        name: string
        msb: number
        lsb: number
        prg: number
        category: string | null
        sub_category: string | null
      }[]

    let rows = load("preferred")
    if (rows.length < 4) {
      const fallback = load("fallback")
      const keys = new Set(
        rows.map((r) => `${r.msb}:${r.lsb}:${r.prg}:${r.name}`),
      )
      for (const row of fallback) {
        const key = `${row.msb}:${row.lsb}:${row.prg}:${row.name}`
        if (keys.has(key)) continue
        keys.add(key)
        rows.push(row)
        if (rows.length >= capped) break
      }
    }

    const seen = new Set<string>()
    const out: LocalAuditionVoiceChoice[] = []
    for (const row of rows) {
      let id = auditionChoiceId(row.name, row.msb, row.lsb, row.prg)
      if (seen.has(id)) {
        id = `${id}_${row.msb}_${row.lsb}_${row.prg}`
      }
      seen.add(id)
      out.push({
        id,
        label: row.name,
        msb: row.msb,
        lsb: row.lsb,
        programYamaha: row.prg,
        group: auditionGroup(family, row.category, row.sub_category),
      })
    }
    return out
  } finally {
    sqlite.close()
  }
}

export function resolveLocalVoices(
  keys: VoiceBankProgramKey[],
  modelKey?: string | null,
): Record<string, LocalKeyboardVoice> {
  const out: Record<string, LocalKeyboardVoice> = {}
  const path = dbPath()
  if (!path || !keys.length) return out

  const unique = new Map<string, VoiceBankProgramKey>()
  for (const key of keys) {
    unique.set(voiceBankProgramKey(key), key)
  }

  const sqlite = new Database(path, { readonly: true })
  try {
    const modelId = resolveModelId(sqlite, modelKey)
    const stmt = sqlite.prepare(
      `SELECT id, msb, lsb, prg, name, category, sub_category
       FROM keyboard_voices
       WHERE model_id = ? AND msb = ? AND lsb = ? AND prg = ?
       LIMIT 1`,
    )
    for (const [id, key] of unique) {
      const row = stmt.get(modelId, key.msb, key.lsb, key.programYamaha) as
        | {
            id: number
            msb: number
            lsb: number
            prg: number
            name: string
            category: string | null
            sub_category: string | null
          }
        | undefined
      if (!row) continue
      out[id] = {
        id: row.id,
        msb: row.msb,
        lsb: row.lsb,
        programYamaha: row.prg,
        name: row.name,
        category: row.category,
        subCategory: row.sub_category,
      }
    }
  } finally {
    sqlite.close()
  }
  return out
}
