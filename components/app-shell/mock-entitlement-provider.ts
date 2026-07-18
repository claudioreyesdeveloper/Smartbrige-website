import { getSharedServiceCatalogEntry } from "@/lib/services/catalog"
import { SERVICE_CATALOG, SERVICE_NAV_ORDER } from "./service-catalog"
import type {
  EntitlementProvider,
  ServiceEntitlement,
  ServiceKey,
} from "./types"

/** Test/dev stand-in. Production /app uses server-derived StaticEntitlementProvider. */
const MOCK_PURCHASED: ServiceKey[] = ["jam-player", "genos-mixer"]

function upgradeHrefFor(key: ServiceKey): string {
  return `/app/billing?service=${key}`
}

function resolveAccess(key: ServiceKey): ServiceEntitlement["access"] {
  if (getSharedServiceCatalogEntry(key).availability === "future") {
    return "coming-soon"
  }
  return MOCK_PURCHASED.includes(key) ? "active" : "upgrade"
}

export class MockEntitlementProvider implements EntitlementProvider {
  getEntitlements(): ServiceEntitlement[] {
    return SERVICE_NAV_ORDER.map((key) => {
      const definition = SERVICE_CATALOG[key]
      const access = resolveAccess(key)
      return {
        ...definition,
        access,
        upgradeHref: upgradeHrefFor(key),
      }
    })
  }

  isActive(key: ServiceKey): boolean {
    return resolveAccess(key) === "active"
  }

  getUpgradeHref(key: ServiceKey): string {
    return upgradeHrefFor(key)
  }
}

export const mockEntitlementProvider = new MockEntitlementProvider()
