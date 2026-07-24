import { and, eq, gte, ilike, lte, or, sql } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { requireDb } from "@/lib/db"
import { libraryClips } from "@/lib/db/schema"
import {
  getAuthUserId,
  userHasActiveSubscription,
} from "@/lib/style-maker/entitlements"
import { isExcludedDrumLibraryCategory } from "@/lib/style-maker/drum-library-categories"
import {
  browseLocalClips,
  localLibraryAvailable,
} from "@/lib/style-maker/local-library"

export async function GET(request: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!(await userHasActiveSubscription(userId))) {
    return NextResponse.json({ error: "Subscription required" }, { status: 402 })
  }

  const params = request.nextUrl.searchParams
  const sourceKind = params.get("sourceKind")
  const category = params.get("category")
  const feel = params.get("feel")
  const feelMode = params.get("feelMode")
  const sectionType = params.get("sectionType")
  const q = params.get("q")
  const bpmMin = params.get("bpmMin")
  const bpmMax = params.get("bpmMax")
  const excludeFillSections = params.get("excludeFillSections") === "1"
  const limit = Math.min(500, Math.max(1, Number(params.get("limit") || 40)))
  const offset = Math.max(0, Number(params.get("offset") || 0))

  if (!sourceKind || !["bass", "drums", "guitar", "brass"].includes(sourceKind)) {
    return NextResponse.json(
      { error: "sourceKind must be bass, drums, guitar, or brass" },
      { status: 400 },
    )
  }

  try {
    if (localLibraryAvailable()) {
      const data = browseLocalClips({
        sourceKind,
        category,
        feel,
        feelMode,
        sectionType,
        q,
        bpmMin: bpmMin ? Number(bpmMin) : null,
        bpmMax: bpmMax ? Number(bpmMax) : null,
        excludeFillSections,
        limit,
        offset,
      })
      return NextResponse.json({ ...data, limit, offset })
    }

    if (
      sourceKind === "drums" &&
      category &&
      isExcludedDrumLibraryCategory(category)
    ) {
      return NextResponse.json({ clips: [], total: 0, limit, offset })
    }

    const db = requireDb()
    const conditions = [eq(libraryClips.sourceKind, sourceKind)]
    if (category) {
      conditions.push(eq(libraryClips.categoryName, category))
    } else if (sourceKind === "drums") {
      conditions.push(
        sql`(${libraryClips.categoryName} is null OR (
          position('percussion' in lower(${libraryClips.categoryName})) = 0
          AND position('cinematic' in lower(${libraryClips.categoryName})) = 0
          AND position('action' in lower(replace(replace(${libraryClips.categoryName}, ' ', '_'), '-', '_'))) = 0
        ))`,
      )
    }
    if (feelMode) {
      conditions.push(sql`lower(coalesce(${libraryClips.feelMode}, '')) = lower(${feelMode})`)
    } else if (feel) {
      conditions.push(eq(libraryClips.feelName, feel))
    }
    if (sectionType) {
      conditions.push(
        or(
          eq(libraryClips.sectionType, sectionType),
          eq(libraryClips.sectionType, "main"),
        )!,
      )
    }
    if (excludeFillSections) {
      conditions.push(
        sql`(${libraryClips.sectionType} is null OR lower(${libraryClips.sectionType}) NOT LIKE '%fill%')`,
      )
    }
    if (q) conditions.push(ilike(libraryClips.clipName, `%${q}%`))
    if (bpmMin) conditions.push(gte(libraryClips.bpm, Number(bpmMin)))
    if (bpmMax) conditions.push(lte(libraryClips.bpm, Number(bpmMax)))

    const where = and(...conditions)
    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: libraryClips.id,
          sourceKind: libraryClips.sourceKind,
          categoryName: libraryClips.categoryName,
          subcategoryName: libraryClips.subcategoryName,
          clipName: libraryClips.clipName,
          feelName: libraryClips.feelName,
          feelMode: libraryClips.feelMode,
          bpm: libraryClips.bpm,
          sectionType: libraryClips.sectionType,
          styleTags: libraryClips.styleTags,
          noteCount: libraryClips.noteCount,
          bars: libraryClips.bars,
          variation: libraryClips.variation,
        })
        .from(libraryClips)
        .where(where)
        .orderBy(libraryClips.categoryName, libraryClips.clipName)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(libraryClips)
        .where(where),
    ])

    return NextResponse.json({
      clips: rows.map((row) => ({
        ...row,
        bars:
          row.bars != null && Number.isFinite(Number(row.bars))
            ? Math.max(1, Math.round(Number(row.bars)))
            : null,
      })),
      total: countRows[0]?.count || 0,
      limit,
      offset,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Library browse failed",
      },
      { status: 500 },
    )
  }
}
