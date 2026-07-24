import { NextRequest, NextResponse } from "next/server"
import {
  getAuthUserId,
  userHasActiveSubscription,
} from "@/lib/style-maker/entitlements"
import {
  hostedKeyboardCatalogAvailable,
  resolveHostedVoices,
} from "@/lib/style-maker/hosted-keyboard-catalog"
import {
  localVoicesAvailable,
  resolveLocalVoices,
  type VoiceBankProgramKey,
} from "@/lib/style-maker/local-voices"

/**
 * Resolve MSB/LSB/PRG → keyboard_voices name + category
 * (Desktop DatabaseManager::findVoiceByMsbLsbPrg).
 *
 * Body: { voices: [{ msb, lsb, programYamaha }], modelKey? }
 */
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!(await userHasActiveSubscription(userId))) {
    return NextResponse.json({ error: "Subscription required" }, { status: 402 })
  }

  const useLocal = localVoicesAvailable() && !hostedKeyboardCatalogAvailable()
  const useHosted = hostedKeyboardCatalogAvailable()
  if (!useLocal && !useHosted) {
    return NextResponse.json({
      voices: {},
      error: "Keyboard voice catalog not available.",
    })
  }

  try {
    const body = (await request.json()) as {
      voices?: VoiceBankProgramKey[]
      modelKey?: string | null
    }
    const keys = (body.voices || [])
      .filter(
        (v) =>
          Number.isFinite(v?.msb) &&
          Number.isFinite(v?.lsb) &&
          Number.isFinite(v?.programYamaha),
      )
      .slice(0, 64)
      .map((v) => ({
        msb: Math.round(v.msb),
        lsb: Math.round(v.lsb),
        programYamaha: Math.round(v.programYamaha),
      }))
    const voices = useHosted
      ? await resolveHostedVoices(keys, body.modelKey)
      : resolveLocalVoices(keys, body.modelKey)
    return NextResponse.json({
      voices,
      modelKey: body.modelKey || null,
      source: useHosted ? "postgres" : "sqlite",
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Voice resolve failed",
      },
      { status: 500 },
    )
  }
}
