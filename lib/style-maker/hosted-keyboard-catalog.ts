/**
 * Hosted Postgres keyboard catalogs (Neon via DATABASE_URL).
 * Mirrors local-voices / local-styles against keyboard_* tables.
 */

import { and, asc, eq, ilike, or, sql } from "drizzle-orm"
import type { StyleCatalogEntry } from "@/lib/demo/types"
import { dbModelKey, type DbModelKey } from "@/lib/demo/yamaha/keyboard-models"
import { requireDb } from "@/lib/db"
import {
  keyboardModels,
  keyboardStyles,
  keyboardVoices,
} from "@/lib/db/schema"
import type {
  AuditionVoiceFamily,
  LocalAuditionVoiceChoice,
  LocalKeyboardVoice,
  VoiceBankProgramKey,
} from "@/lib/style-maker/local-voices"
import { voiceBankProgramKey } from "@/lib/style-maker/local-voices"

export function hostedKeyboardCatalogAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

async function resolveModelId(modelKey?: string | null): Promise<number | null> {
  const db = requireDb()
  const key = dbModelKey(modelKey)
  if (key) {
    const rows = await db
      .select({ id: keyboardModels.id })
      .from(keyboardModels)
      .where(eq(keyboardModels.modelKey, key))
      .limit(1)
    if (rows[0]) return rows[0].id
  }
  const active = await db
    .select({ id: keyboardModels.id })
    .from(keyboardModels)
    .where(eq(keyboardModels.isActive, 1))
    .orderBy(asc(keyboardModels.id))
    .limit(1)
  return active[0]?.id ?? null
}

export async function listHostedVoiceCategories(
  modelKey?: string | null,
): Promise<string[]> {
  const modelId = await resolveModelId(modelKey)
  if (modelId == null) return []
  const db = requireDb()
  const rows = await db
    .selectDistinct({ category: keyboardVoices.category })
    .from(keyboardVoices)
    .where(
      and(
        eq(keyboardVoices.modelId, modelId),
        sql`${keyboardVoices.category} IS NOT NULL`,
        sql`trim(${keyboardVoices.category}) != ''`,
      ),
    )
    .orderBy(asc(keyboardVoices.category))
  return rows
    .map((r) => r.category)
    .filter((c): c is string => Boolean(c))
}

export async function searchHostedVoices(options: {
  q?: string | null
  category?: string | null
  limit?: number
  modelKey?: string | null
}): Promise<LocalKeyboardVoice[]> {
  const modelId = await resolveModelId(options.modelKey)
  if (modelId == null) return []
  const limit = Math.min(200, Math.max(1, options.limit ?? 80))
  const db = requireDb()
  const filters = [eq(keyboardVoices.modelId, modelId)]
  if (options.category?.trim()) {
    filters.push(eq(keyboardVoices.category, options.category.trim()))
  }
  if (options.q?.trim()) {
    filters.push(ilike(keyboardVoices.name, `%${options.q.trim()}%`))
  }
  const rows = await db
    .select({
      id: keyboardVoices.id,
      msb: keyboardVoices.msb,
      lsb: keyboardVoices.lsb,
      prg: keyboardVoices.prg,
      name: keyboardVoices.name,
      category: keyboardVoices.category,
      subCategory: keyboardVoices.subCategory,
    })
    .from(keyboardVoices)
    .where(and(...filters))
    .orderBy(asc(keyboardVoices.displayOrder), asc(keyboardVoices.name))
    .limit(limit)
  return rows.map((r) => ({
    id: r.id,
    msb: r.msb,
    lsb: r.lsb,
    programYamaha: r.prg,
    name: r.name,
    category: r.category,
    subCategory: r.subCategory,
  }))
}

export async function resolveHostedVoices(
  keys: VoiceBankProgramKey[],
  modelKey?: string | null,
): Promise<Record<string, LocalKeyboardVoice>> {
  const out: Record<string, LocalKeyboardVoice> = {}
  if (!keys.length) return out
  const modelId = await resolveModelId(modelKey)
  if (modelId == null) return out

  const unique = new Map<string, VoiceBankProgramKey>()
  for (const key of keys) {
    unique.set(voiceBankProgramKey(key), key)
  }

  const db = requireDb()
  for (const [id, key] of unique) {
    const rows = await db
      .select({
        id: keyboardVoices.id,
        msb: keyboardVoices.msb,
        lsb: keyboardVoices.lsb,
        prg: keyboardVoices.prg,
        name: keyboardVoices.name,
        category: keyboardVoices.category,
        subCategory: keyboardVoices.subCategory,
      })
      .from(keyboardVoices)
      .where(
        and(
          eq(keyboardVoices.modelId, modelId),
          eq(keyboardVoices.msb, key.msb),
          eq(keyboardVoices.lsb, key.lsb),
          eq(keyboardVoices.prg, key.programYamaha),
        ),
      )
      .limit(1)
    const row = rows[0]
    if (!row) continue
    out[id] = {
      id: row.id,
      msb: row.msb,
      lsb: row.lsb,
      programYamaha: row.prg,
      name: row.name,
      category: row.category,
      subCategory: row.subCategory,
    }
  }
  return out
}

function auditionPreferredSql(family: AuditionVoiceFamily) {
  const cat = sql`lower(coalesce(${keyboardVoices.category}, ''))`
  const sub = sql`lower(coalesce(${keyboardVoices.subCategory}, ''))`
  switch (family) {
    case "drums":
      return or(sql`${cat} = 'drumkit'`, sql`${sub} = 'drumkit`)
    case "bass":
      return or(
        and(
          sql`${cat} in ('megavoice', 'megavoices')`,
          sql`${sub} = 'bass'`,
        ),
        and(sql`${cat} = 'bass'`, eq(keyboardVoices.msb, 8)),
      )
    case "guitar":
      return or(
        and(
          sql`${cat} in ('megavoice', 'megavoices')`,
          sql`${sub} in ('a.guitar', 'e.guitar')`,
        ),
        and(
          sql`${cat} in ('a.guitar', 'e.guitar')`,
          eq(keyboardVoices.msb, 8),
        ),
      )
    case "brass":
      return and(
        sql`${cat} in ('megavoice', 'megavoices')`,
        sql`${sub} = 'brass'`,
      )
  }
}

function auditionFallbackSql(family: AuditionVoiceFamily) {
  const cat = sql`lower(coalesce(${keyboardVoices.category}, ''))`
  const sub = sql`lower(coalesce(${keyboardVoices.subCategory}, ''))`
  switch (family) {
    case "drums":
      return or(
        sql`${cat} in ('perc&drum', 'percussion')`,
        sql`${sub} in ('drums', 'percussion')`,
      )
    case "bass":
      return or(
        sql`${cat} = 'bass'`,
        and(
          sql`${cat} in ('guitar&bass', 'guitar & bass')`,
          sql`${sub} = 'bass'`,
        ),
      )
    case "guitar":
      return or(
        sql`${cat} in ('a.guitar', 'e.guitar')`,
        and(
          sql`${cat} in ('guitar&bass', 'guitar & bass')`,
          sql`${sub} in ('a.guitar', 'e.guitar', 'guitar')`,
        ),
      )
    case "brass":
      return sql`${cat} = 'brass'`
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
  if (family === "drums") return cat === "legacy" ? "Legacy" : "DrumKit"
  if (family === "brass") return "Brass"
  return "MegaVoice Bass"
}

function auditionChoiceId(name: string, msb: number, lsb: number, prg: number): string {
  const cleaned = name.replace(/\s+/g, "").trim()
  return cleaned || `${msb}:${lsb}:${prg}`
}

export async function listHostedAuditionVoices(
  modelKey: string | null | undefined,
  family: AuditionVoiceFamily,
  limit = 300,
): Promise<LocalAuditionVoiceChoice[]> {
  const modelId = await resolveModelId(modelKey)
  if (modelId == null) return []
  const capped = Math.min(400, Math.max(1, limit))
  const db = requireDb()

  const load = async (preferred: boolean) => {
    const familySql = preferred
      ? auditionPreferredSql(family)
      : auditionFallbackSql(family)
    return db
      .select({
        name: keyboardVoices.name,
        msb: keyboardVoices.msb,
        lsb: keyboardVoices.lsb,
        prg: keyboardVoices.prg,
        category: keyboardVoices.category,
        subCategory: keyboardVoices.subCategory,
      })
      .from(keyboardVoices)
      .where(and(eq(keyboardVoices.modelId, modelId), familySql))
      .orderBy(asc(keyboardVoices.displayOrder), asc(keyboardVoices.name))
      .limit(capped)
  }

  let rows = await load(true)
  if (rows.length < 4) {
    const fallback = await load(false)
    const keys = new Set(rows.map((r) => `${r.msb}:${r.lsb}:${r.prg}:${r.name}`))
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
    if (seen.has(id)) id = `${id}_${row.msb}_${row.lsb}_${row.prg}`
    seen.add(id)
    out.push({
      id,
      label: row.name,
      msb: row.msb,
      lsb: row.lsb,
      programYamaha: row.prg,
      group: auditionGroup(family, row.category, row.subCategory),
    })
  }
  return out
}

export async function listHostedStyleCategories(
  modelKey?: string | null,
): Promise<string[]> {
  const modelId = await resolveModelId(modelKey)
  if (modelId == null) return []
  const db = requireDb()
  const rows = await db
    .selectDistinct({ category: keyboardStyles.category })
    .from(keyboardStyles)
    .where(
      and(
        eq(keyboardStyles.modelId, modelId),
        sql`${keyboardStyles.category} IS NOT NULL`,
        sql`trim(${keyboardStyles.category}) != ''`,
      ),
    )
    .orderBy(asc(keyboardStyles.category))
  return rows
    .map((r) => r.category)
    .filter((c): c is string => Boolean(c))
}

export async function listHostedStyles(
  modelKey?: string | null,
): Promise<StyleCatalogEntry[]> {
  const modelId = await resolveModelId(modelKey)
  if (modelId == null) return []
  const db = requireDb()
  const rows = await db
    .select({
      styleNumber: keyboardStyles.styleNumber,
      name: keyboardStyles.name,
      category: keyboardStyles.category,
    })
    .from(keyboardStyles)
    .where(eq(keyboardStyles.modelId, modelId))
    .orderBy(asc(keyboardStyles.displayOrder), asc(keyboardStyles.name))
  return rows.map((r) => ({
    name: r.name,
    category: r.category || "Other",
    styleNumber: r.styleNumber,
    bpm: 0,
  }))
}

export async function listHostedKeyboardModels(): Promise<
  { modelKey: DbModelKey; displayName: string }[]
> {
  const db = requireDb()
  const rows = await db
    .select({
      modelKey: keyboardModels.modelKey,
      displayName: keyboardModels.displayName,
    })
    .from(keyboardModels)
    .orderBy(asc(keyboardModels.displayName))
  return rows
    .map((r) => ({
      modelKey: dbModelKey(r.modelKey) as DbModelKey,
      displayName: r.displayName,
    }))
    .filter((r) => r.modelKey)
}
