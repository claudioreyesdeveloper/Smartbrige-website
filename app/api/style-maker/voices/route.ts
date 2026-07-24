import { NextRequest, NextResponse } from "next/server"
import {
  getAuthUserId,
  userHasActiveSubscription,
} from "@/lib/style-maker/entitlements"
import {
  hostedKeyboardCatalogAvailable,
  listHostedAuditionVoices,
  listHostedVoiceCategories,
  searchHostedVoices,
} from "@/lib/style-maker/hosted-keyboard-catalog"
import {
  listLocalAuditionVoices,
  listLocalVoiceCategories,
  localVoicesAvailable,
  searchLocalVoices,
  type AuditionVoiceFamily,
} from "@/lib/style-maker/local-voices"

const AUDITION_FAMILIES = new Set<AuditionVoiceFamily>([
  "bass",
  "guitar",
  "drums",
  "brass",
])

export async function GET(request: NextRequest) {
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
      voices: [],
      categories: [],
      error: "Keyboard voice catalog not available.",
    })
  }

  const params = request.nextUrl.searchParams
  const q = params.get("q")
  const category = params.get("category")
  const modelKey = params.get("modelKey")
  const limit = Number(params.get("limit") || 80)
  const categoriesOnly = params.get("categoriesOnly") === "1"
  const auditionFamily = params.get("auditionFamily") as AuditionVoiceFamily | null

  try {
    if (auditionFamily && AUDITION_FAMILIES.has(auditionFamily)) {
      const voices = useHosted
        ? await listHostedAuditionVoices(modelKey, auditionFamily, limit || 300)
        : listLocalAuditionVoices(modelKey, auditionFamily, limit || 300)
      return NextResponse.json({
        voices,
        modelKey: modelKey || null,
        auditionFamily,
        source: useHosted ? "postgres" : "sqlite",
      })
    }
    if (categoriesOnly) {
      const categories = useHosted
        ? await listHostedVoiceCategories(modelKey)
        : listLocalVoiceCategories(modelKey)
      return NextResponse.json({
        categories,
        modelKey: modelKey || null,
        source: useHosted ? "postgres" : "sqlite",
      })
    }
    const voices = useHosted
      ? await searchHostedVoices({ q, category, limit, modelKey })
      : searchLocalVoices({ q, category, limit, modelKey })
    const categories = useHosted
      ? await listHostedVoiceCategories(modelKey)
      : listLocalVoiceCategories(modelKey)
    return NextResponse.json({
      voices,
      categories,
      modelKey: modelKey || null,
      source: useHosted ? "postgres" : "sqlite",
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Voice search failed",
      },
      { status: 500 },
    )
  }
}
