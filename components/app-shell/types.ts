import type { ServiceKey } from "@/lib/services/catalog"

export { SERVICE_KEYS, type ServiceKey } from "@/lib/services/catalog"

export type ServiceAccess = "active" | "upgrade" | "coming-soon"

export type ServiceDefinition = {
  key: ServiceKey
  name: string
  tagline: string
  description: string
  path: string
}

export type ServiceEntitlement = ServiceDefinition & {
  access: ServiceAccess
  upgradeHref: string
}

export interface EntitlementProvider {
  getEntitlements(): ServiceEntitlement[]
  isActive(key: ServiceKey): boolean
  getUpgradeHref(key: ServiceKey): string
}

export type PartitionedEntitlements = {
  active: ServiceEntitlement[]
  upgrade: ServiceEntitlement[]
  comingSoon: ServiceEntitlement[]
}

export function partitionEntitlements(
  entitlements: ServiceEntitlement[],
): PartitionedEntitlements {
  return {
    active: entitlements.filter((item) => item.access === "active"),
    upgrade: entitlements.filter((item) => item.access === "upgrade"),
    comingSoon: entitlements.filter((item) => item.access === "coming-soon"),
  }
}
