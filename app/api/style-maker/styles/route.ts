import { NextRequest, NextResponse } from "next/server"
import {
  getAuthUserId,
  userHasActiveSubscription,
} from "@/lib/style-maker/entitlements"
import {
  hostedKeyboardCatalogAvailable,
  listHostedStyleCategories,
  listHostedStyles,
} from "@/lib/style-maker/hosted-keyboard-catalog"
import {
  listLocalStyleCategories,
  listLocalStyles,
  localStylesAvailable,
} from "@/lib/style-maker/local-styles"

/**
 * Model-scoped factory styles from keyboard_styles
 * (Desktop DatabaseManager keyboard style catalog).
 *
 * Query: modelKey=genos2|tyros5|psr_sx900|…  (website `genos` → genos1)
 */
export async function GET(request: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!(await userHasActiveSubscription(userId))) {
    return NextResponse.json({ error: "Subscription required" }, { status: 402 })
  }

  const useLocal = localStylesAvailable() && !hostedKeyboardCatalogAvailable()
  const useHosted = hostedKeyboardCatalogAvailable()
  if (!useLocal && !useHosted) {
    return NextResponse.json({
      styles: [],
      categories: [],
      error: "Keyboard style catalog not available.",
    })
  }

  const modelKey = request.nextUrl.searchParams.get("modelKey")

  try {
    const styles = useHosted
      ? await listHostedStyles(modelKey)
      : listLocalStyles(modelKey)
    const categories = useHosted
      ? await listHostedStyleCategories(modelKey)
      : listLocalStyleCategories(modelKey)
    return NextResponse.json({
      styles,
      categories,
      modelKey: modelKey || null,
      source: useHosted ? "postgres" : "sqlite",
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Style catalog failed",
      },
      { status: 500 },
    )
  }
}
