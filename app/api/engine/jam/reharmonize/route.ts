import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { jamErrorResponse, readJamJsonBody } from "@/lib/engine-proxy/http"
import { getJamEngineService } from "@/lib/engine-proxy/runtime"
import { JamError } from "@/lib/jam/domain/errors"
import { parseJamReharmonizeRequest } from "@/lib/jam/domain/validate"

export const runtime = "nodejs"

/**
 * POST /api/engine/jam/reharmonize
 * Authenticated jam-player users request opaque chord candidates only.
 */
export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      throw new JamError("unauthenticated", "Authentication is required.")
    }
    const body = await readJamJsonBody(request)
    const parsed = parseJamReharmonizeRequest(body)
    const result = await getJamEngineService().reharmonize(userId, parsed)
    return NextResponse.json(result)
  } catch (error) {
    return jamErrorResponse(error)
  }
}
