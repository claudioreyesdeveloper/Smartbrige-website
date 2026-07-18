import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { jamErrorResponse, readJamJsonBody } from "@/lib/engine-proxy/http"
import { JamError } from "@/lib/jam/domain/errors"
import { getRhythmService } from "@/lib/rhythm/runtime"
import { parseRhythmOptionsRequest } from "@/lib/rhythm/domain"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) throw new JamError("unauthenticated", "Authentication is required.")
    const body = parseRhythmOptionsRequest(await readJamJsonBody(request))
    return NextResponse.json(await getRhythmService().options(userId, body))
  } catch (error) {
    return jamErrorResponse(error)
  }
}
