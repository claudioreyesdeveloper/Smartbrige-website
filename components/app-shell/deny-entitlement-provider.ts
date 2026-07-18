import type { EntitlementProvider } from "./types"

/** Fail-closed default used when no entitlement snapshot is injected. */
export const denyAllEntitlementProvider: EntitlementProvider = {
  getEntitlements: () => [],
  isActive: () => false,
  getUpgradeHref: (key) => `/app/billing?service=${key}`,
}
