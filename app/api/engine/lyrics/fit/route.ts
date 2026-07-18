import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import {
  lyricFitPublicRequestSchema,
  parseCreative,
} from "@/lib/creative/contracts"
import { getCreativeService } from "@/lib/creative/runtime"
import { jamErrorResponse, readJamJsonBody } from "@/lib/engine-proxy/http"
import { JamError } from "@/lib/jam/domain/errors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) throw new JamError("unauthenticated", "Authentication is required.")
    const body = parseCreative(lyricFitPublicRequestSchema, await readJamJsonBody(request))
    return NextResponse.json(await getCreativeService().lyricFit(userId, body), {
      headers: { "Cache-Control": "no-store, private" },
    })
  } catch (error) {
    return jamErrorResponse(error)
  }
}
