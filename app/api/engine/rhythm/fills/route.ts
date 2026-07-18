import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { jamErrorResponse, readJamJsonBody } from "@/lib/engine-proxy/http"
import { JamError } from "@/lib/jam/domain/errors"
import { parseRhythmFillsRequest } from "@/lib/rhythm/domain"
import { getRhythmService } from "@/lib/rhythm/runtime"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) throw new JamError("unauthenticated", "Authentication is required.")
    const body = parseRhythmFillsRequest(await readJamJsonBody(request))
    return NextResponse.json(await getRhythmService().fills(userId, body))
  } catch (error) {
    return jamErrorResponse(error)
  }
}
