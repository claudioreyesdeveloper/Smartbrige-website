import type { EntitlementProvider, ServiceEntitlement, ServiceKey } from "./types"

/** Injectable provider backed by server-derived (or test) entitlement snapshots. */
export class StaticEntitlementProvider implements EntitlementProvider {
  private readonly byKey: Map<ServiceKey, ServiceEntitlement>

  constructor(private readonly entitlements: ServiceEntitlement[]) {
    this.byKey = new Map(entitlements.map((item) => [item.key, item]))
  }

  getEntitlements(): ServiceEntitlement[] {
    return this.entitlements
  }

  isActive(key: ServiceKey): boolean {
    return this.byKey.get(key)?.access === "active"
  }

  getUpgradeHref(key: ServiceKey): string {
    return this.byKey.get(key)?.upgradeHref ?? `/app/billing?service=${key}`
  }
}
