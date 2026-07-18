import { SERVICE_CATALOG, SERVICE_NAV_ORDER } from "./service-catalog"
import type {
  EntitlementProvider,
  ServiceEntitlement,
  ServiceKey,
} from "./types"

/** Temporary stand-in until auth + billing entitlements land (A03+). */
const MOCK_PURCHASED: ServiceKey[] = ["jam-player", "genos-mixer"]

const MOCK_UPGRADE_BASE = "/app#upgrade"

function resolveAccess(key: ServiceKey): ServiceEntitlement["access"] {
  if (key === "style-maker") return "coming-soon"
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
        upgradeHref: `${MOCK_UPGRADE_BASE}-${key}`,
      }
    })
  }

  isActive(key: ServiceKey): boolean {
    return resolveAccess(key) === "active"
  }

  getUpgradeHref(key: ServiceKey): string {
    return `${MOCK_UPGRADE_BASE}-${key}`
  }
}

export const mockEntitlementProvider = new MockEntitlementProvider()
