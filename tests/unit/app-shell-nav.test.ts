import { describe, expect, it } from "vitest"
import {
  JAM_PLAYER_SUB_TABS,
  isJamPlayerFamilyPath,
  resolveJamPlayerSubTab,
  resolveServiceKeyForPath,
} from "@/components/app-shell/jam-player-routes"
import {
  PRIMARY_SERVICE_NAV_ORDER,
  SERVICE_CATALOG,
  SERVICE_NAV_ORDER,
} from "@/components/app-shell/service-catalog"
import {
  PRIMARY_NAV_KEYS,
  SERVICE_KEYS,
  getPrimaryNavOrder,
  isJamChildServiceKey,
  isPrimaryNavKey,
} from "@/lib/services/catalog"

describe("app-shell primary vs jam-child nav", () => {
  it("keeps full entitlement order while primary nav is Jam Player + Genos Mixer", () => {
    expect(SERVICE_NAV_ORDER).toHaveLength(SERVICE_KEYS.length)
    expect(new Set(SERVICE_NAV_ORDER)).toEqual(new Set(SERVICE_KEYS))
    expect(PRIMARY_SERVICE_NAV_ORDER).toEqual(["jam-player", "genos-mixer"])
    expect(getPrimaryNavOrder()).toEqual([...PRIMARY_NAV_KEYS])
    expect(isPrimaryNavKey("jam-player")).toBe(true)
    expect(isPrimaryNavKey("bass-drums")).toBe(false)
    expect(isJamChildServiceKey("solo-phrases")).toBe(true)
  })

  it("nests bass, drums, solo, and lyrics under Jam Player paths", () => {
    expect(SERVICE_CATALOG["jam-player"].path).toBe("/app/jam-player")
    expect(SERVICE_CATALOG["bass-drums"].path).toBe("/app/jam-player/bass")
    expect(SERVICE_CATALOG["solo-phrases"].path).toBe("/app/jam-player/solo")
    expect(SERVICE_CATALOG.lyrics.path).toBe("/app/jam-player/lyrics")
    expect(SERVICE_CATALOG["genos-mixer"].path).toBe("/app/genos-mixer")
  })

  it("resolves Jam Player family paths and active sub-tabs", () => {
    expect(isJamPlayerFamilyPath("/app/jam-player")).toBe(true)
    expect(isJamPlayerFamilyPath("/app/jam-player/bass")).toBe(true)
    expect(isJamPlayerFamilyPath("/app/genos-mixer")).toBe(false)

    expect(resolveJamPlayerSubTab("/app/jam-player")?.id).toBe("song")
    expect(resolveJamPlayerSubTab("/app/jam-player/bass")?.id).toBe("bass")
    expect(resolveJamPlayerSubTab("/app/jam-player/drums")?.id).toBe("drums")
    expect(resolveJamPlayerSubTab("/app/jam-player/solo")?.id).toBe("solo")
    expect(resolveJamPlayerSubTab("/app/jam-player/lyrics")?.id).toBe("lyrics")

    expect(JAM_PLAYER_SUB_TABS.map((tab) => tab.id)).toEqual([
      "song",
      "bass",
      "drums",
      "solo",
      "lyrics",
    ])
  })

  it("maps nested routes to entitlement service keys", () => {
    expect(resolveServiceKeyForPath("/app/jam-player")).toBe("jam-player")
    expect(resolveServiceKeyForPath("/app/jam-player/bass")).toBe("bass-drums")
    expect(resolveServiceKeyForPath("/app/jam-player/drums")).toBe("bass-drums")
    expect(resolveServiceKeyForPath("/app/jam-player/solo")).toBe("solo-phrases")
    expect(resolveServiceKeyForPath("/app/genos-mixer")).toBe("genos-mixer")
  })
})
