import type { NextRequest } from "next/server"
import { getAuthExports } from "@/lib/auth/runtime"

export async function GET(request: NextRequest) {
  return getAuthExports().handlers.GET(request)
}

export async function POST(request: NextRequest) {
  return getAuthExports().handlers.POST(request)
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
