import type { ServiceKey } from "@/lib/services/catalog"

export type JamPlayerSubTabId = "song" | "bass" | "drums" | "solo" | "lyrics"

export type JamPlayerSubTab = {
  id: JamPlayerSubTabId
  label: string
  path: string
  /** Entitlement key gated by ServiceAccessGate for this tab. */
  serviceKey: ServiceKey
}

export const JAM_PLAYER_SUB_TABS: readonly JamPlayerSubTab[] = [
  {
    id: "song",
    label: "Song & Chords",
    path: "/app/jam-player",
    serviceKey: "jam-player",
  },
  {
    id: "bass",
    label: "Bass",
    path: "/app/jam-player/bass",
    serviceKey: "bass-drums",
  },
  {
    id: "drums",
    label: "Drums",
    path: "/app/jam-player/drums",
    serviceKey: "bass-drums",
  },
  {
    id: "solo",
    label: "Solo Phrases",
    path: "/app/jam-player/solo",
    serviceKey: "solo-phrases",
  },
  {
    id: "lyrics",
    label: "Lyrics",
    path: "/app/jam-player/lyrics",
    serviceKey: "lyrics",
  },
] as const

export function isJamPlayerFamilyPath(pathname: string): boolean {
  return pathname === "/app/jam-player" || pathname.startsWith("/app/jam-player/")
}

export function resolveJamPlayerSubTab(pathname: string): JamPlayerSubTab | null {
  if (!isJamPlayerFamilyPath(pathname)) return null
  const match = [...JAM_PLAYER_SUB_TABS]
    .sort((left, right) => right.path.length - left.path.length)
    .find((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`))
  return match ?? JAM_PLAYER_SUB_TABS[0]
}

/** Map a pathname to the entitlement/service definition that owns the page title. */
export function resolveServiceKeyForPath(pathname: string): ServiceKey | null {
  if (pathname === "/app/genos-mixer" || pathname.startsWith("/app/genos-mixer/")) {
    return "genos-mixer"
  }
  const jamTab = resolveJamPlayerSubTab(pathname)
  if (jamTab) return jamTab.serviceKey
  return null
}
