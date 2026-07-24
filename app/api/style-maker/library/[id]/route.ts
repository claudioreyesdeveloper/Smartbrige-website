import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { requireDb } from "@/lib/db"
import { libraryClips } from "@/lib/db/schema"
import {
  getAuthUserId,
  userHasActiveSubscription,
} from "@/lib/style-maker/entitlements"
import {
  fetchLocalClipMidi,
  localLibraryAvailable,
} from "@/lib/style-maker/local-library"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!(await userHasActiveSubscription(userId))) {
    return NextResponse.json({ error: "Subscription required" }, { status: 402 })
  }

  const { id } = await context.params
  const clipId = Number(id)
  if (!Number.isFinite(clipId)) {
    return NextResponse.json({ error: "Invalid clip id" }, { status: 400 })
  }

  try {
    if (localLibraryAvailable()) {
      const row = fetchLocalClipMidi(clipId)
      if (!row) {
        return NextResponse.json({ error: "Clip not found" }, { status: 404 })
      }
      return new NextResponse(new Uint8Array(row.midiData), {
        status: 200,
        headers: {
          "Content-Type": "audio/midi",
          "Content-Disposition": `attachment; filename="${(row.clipName || "clip").replace(/[^\w.-]+/g, "_")}.mid"`,
          "X-Clip-Id": String(clipId),
          "X-Clip-Name": row.clipName || "",
          "X-Source-Kind": row.sourceKind,
        },
      })
    }

    const db = requireDb()
    const rows = await db
      .select({
        id: libraryClips.id,
        sourceKind: libraryClips.sourceKind,
        clipName: libraryClips.clipName,
        midiData: libraryClips.midiData,
      })
      .from(libraryClips)
      .where(eq(libraryClips.id, clipId))
      .limit(1)

    const row = rows[0]
    if (!row) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(row.midiData), {
      status: 200,
      headers: {
        "Content-Type": "audio/midi",
        "Content-Disposition": `attachment; filename="${(row.clipName || "clip").replace(/[^\w.-]+/g, "_")}.mid"`,
        "X-Clip-Id": String(row.id),
        "X-Clip-Name": row.clipName || "",
        "X-Source-Kind": row.sourceKind,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Clip fetch failed",
      },
      { status: 500 },
    )
  }
}
