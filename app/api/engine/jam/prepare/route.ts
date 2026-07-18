import { NextResponse } from "next/server"
import { ensureFixtureUserExists } from "@/lib/access/ensure-fixture-user"
import { getSessionUserId } from "@/lib/auth"
import { jamErrorResponse, readJamJsonBody } from "@/lib/engine-proxy/http"
import { getJamEngineService } from "@/lib/engine-proxy/runtime"
import { JamError } from "@/lib/jam/domain/errors"
import { parseJamPrepareRequest } from "@/lib/jam/domain/validate"

export const runtime = "nodejs"

/**
 * POST /api/engine/jam/prepare
 * Authenticated jam-player users request a precomputed playback plan.
 * Playback itself remains server-free after this response.
 */
export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      throw new JamError("unauthenticated", "Authentication is required.")
    }
    if (userId === "preview-user" || userId === "fixture-user") {
      await ensureFixtureUserExists({
        userId,
        email:
          userId === "preview-user"
            ? "preview@thesmartbridge.io"
            : "fixture@example.com",
      })
    }
    const body = await readJamJsonBody(request)
    const parsed = parseJamPrepareRequest(body)
    const result = await getJamEngineService().prepare(userId, parsed)
    return NextResponse.json(result)
  } catch (error) {
    return jamErrorResponse(error)
  }
}
