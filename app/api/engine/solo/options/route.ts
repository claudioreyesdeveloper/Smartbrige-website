import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import {
  parseCreative,
  soloOptionsPublicRequestSchema,
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
    const body = parseCreative(soloOptionsPublicRequestSchema, await readJamJsonBody(request))
    return NextResponse.json(await getCreativeService().soloOptions(userId, body), {
      headers: { "Cache-Control": "no-store, private" },
    })
  } catch (error) {
    return jamErrorResponse(error)
  }
}
