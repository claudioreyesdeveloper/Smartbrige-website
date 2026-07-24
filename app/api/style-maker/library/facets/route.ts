import { and, eq, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { requireDb } from "@/lib/db"
import { libraryClips } from "@/lib/db/schema"
import {
  getAuthUserId,
  userHasActiveSubscription,
} from "@/lib/style-maker/entitlements"
import { filterDrumLibraryCategories } from "@/lib/style-maker/drum-library-categories"
import {
  localFacets,
  localLibraryAvailable,
} from "@/lib/style-maker/local-library"

export async function GET(request: Request) {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!(await userHasActiveSubscription(userId))) {
    return NextResponse.json({ error: "Subscription required" }, { status: 402 })
  }

  const url = new URL(request.url)
  const sourceKind = url.searchParams.get("sourceKind")
  const category = url.searchParams.get("category")
  if (!sourceKind || !["bass", "drums", "guitar", "brass"].includes(sourceKind)) {
    return NextResponse.json(
      { error: "sourceKind must be bass, drums, guitar, or brass" },
      { status: 400 },
    )
  }

  try {
    if (localLibraryAvailable()) {
      return NextResponse.json(localFacets(sourceKind, { category }))
    }

    const db = requireDb()
    const categories = await db
      .selectDistinct({ categoryName: libraryClips.categoryName })
      .from(libraryClips)
      .where(
        and(
          eq(libraryClips.sourceKind, sourceKind),
          sql`${libraryClips.categoryName} is not null`,
        ),
      )
      .orderBy(libraryClips.categoryName)

    const feels = await db
      .selectDistinct({ feelMode: libraryClips.feelMode })
      .from(libraryClips)
      .where(
        and(
          eq(libraryClips.sourceKind, sourceKind),
          sql`${libraryClips.feelMode} is not null AND trim(${libraryClips.feelMode}) <> ''`,
        ),
      )
      .orderBy(libraryClips.feelMode)

    const sectionWhere = [
      eq(libraryClips.sourceKind, sourceKind),
      sql`${libraryClips.sectionType} is not null AND trim(${libraryClips.sectionType}) <> ''`,
    ]
    if (category) sectionWhere.push(eq(libraryClips.categoryName, category))

    const sections = await db
      .selectDistinct({ sectionType: libraryClips.sectionType })
      .from(libraryClips)
      .where(and(...sectionWhere))
      .orderBy(libraryClips.sectionType)

    const categoryNames = categories
      .map((r) => r.categoryName)
      .filter((name): name is string => Boolean(name))

    return NextResponse.json({
      categories:
        sourceKind === "drums"
          ? filterDrumLibraryCategories(categoryNames)
          : categoryNames,
      feels: feels.map((r) => r.feelMode).filter(Boolean),
      sections: sections.map((r) => r.sectionType).filter(Boolean),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Facets failed",
      },
      { status: 500 },
    )
  }
}
