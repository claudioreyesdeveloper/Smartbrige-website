import type { Metadata } from "next"
import { PracticeScreen } from "@/components/band-jam/practice-screen"
import { getJamPlayerEntitlement } from "@/lib/billing/entitlements"

export const metadata: Metadata = {
  title: "Jam Player",
  description:
    "Choose a style and progression, mute your instrument, and practise with a SmartBridge virtual band.",
}

// Deliberately not gated by middleware — the free tier (limited catalogue,
// all practice features, no card) must stay reachable by anyone, signed in
// or not. `getJamPlayerEntitlement()` resolves to `hasFullAccess: false`
// for anonymous/free users rather than throwing or redirecting.
// See docs/jam-player-product-plan.md §5 and middleware.ts.
export default async function JamPlayerAppPage() {
  const { hasFullAccess } = await getJamPlayerEntitlement()
  return <PracticeScreen hasFullAccess={hasFullAccess} />
}
