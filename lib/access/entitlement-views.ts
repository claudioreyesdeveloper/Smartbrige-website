import type { EntitlementRecord, EntitlementStatus } from "@/lib/auth/entitlement-logic"
import { userHasServiceAccess } from "@/lib/auth/entitlement-logic"
import { getSharedServiceCatalogEntry, type ServiceKey } from "@/lib/services/catalog"
import { SERVICE_CATALOG, SERVICE_NAV_ORDER } from "@/components/app-shell/service-catalog"
import type { ServiceEntitlement } from "@/components/app-shell/types"

function upgradeHrefFor(serviceKey: ServiceKey): string {
  return `/app/billing?service=${serviceKey}`
}

export type AccountServiceRow = {
  key: ServiceKey
  name: string
  description: string
  access: ServiceEntitlement["access"]
  entitlementStatus: EntitlementStatus | "none"
  upgradeHref: string
  path: string
}

/**
 * Build UI entitlements from server-derived records only.
 * Never accepts client-supplied access flags.
 */
export function buildServiceEntitlements(
  records: EntitlementRecord[],
  now: Date = new Date(),
): ServiceEntitlement[] {
  return SERVICE_NAV_ORDER.map((key) => {
    const definition = SERVICE_CATALOG[key]
    const catalog = getSharedServiceCatalogEntry(key)
    const upgradeHref = upgradeHrefFor(key)

    if (catalog.availability === "future") {
      return {
        ...definition,
        access: "coming-soon" as const,
        upgradeHref,
      }
    }

    const active = userHasServiceAccess(records, key, now)
    return {
      ...definition,
      access: active ? ("active" as const) : ("upgrade" as const),
      upgradeHref,
    }
  })
}

export function buildAccountServiceRows(
  records: EntitlementRecord[],
  now: Date = new Date(),
): AccountServiceRow[] {
  return SERVICE_NAV_ORDER.map((key) => {
    const definition = SERVICE_CATALOG[key]
    const catalog = getSharedServiceCatalogEntry(key)
    const upgradeHref = upgradeHrefFor(key)
    const record = records.find((item) => item.serviceKey === key)

    if (catalog.availability === "future") {
      return {
        key,
        name: definition.name,
        description: definition.description,
        access: "coming-soon",
        entitlementStatus: "none",
        upgradeHref,
        path: definition.path,
      }
    }

    const active = userHasServiceAccess(records, key, now)
    return {
      key,
      name: definition.name,
      description: definition.description,
      access: active ? "active" : "upgrade",
      entitlementStatus: record?.status ?? "none",
      upgradeHref,
      path: definition.path,
    }
  })
}
