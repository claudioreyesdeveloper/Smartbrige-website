import type { ServiceKey } from "@/lib/db/services"

export type EntitlementStatus = "active" | "trialing" | "canceled" | "expired"

export type EntitlementRecord = {
  grantId?: string
  serviceKey: ServiceKey
  status: EntitlementStatus
  validFrom: Date
  validUntil: Date | null
}

const ACTIVE_STATUSES = new Set<EntitlementStatus>(["active", "trialing"])

export function isEntitlementCurrentlyActive(
  record: EntitlementRecord,
  now: Date = new Date(),
): boolean {
  if (!ACTIVE_STATUSES.has(record.status)) {
    return false
  }
  if (record.validFrom > now) {
    return false
  }
  if (record.validUntil && record.validUntil <= now) {
    return false
  }
  return true
}

export function userHasServiceAccess(
  records: EntitlementRecord[],
  serviceKey: ServiceKey,
  now: Date = new Date(),
): boolean {
  return records.some(
    (record) => record.serviceKey === serviceKey && isEntitlementCurrentlyActive(record, now),
  )
}

export function listActiveServiceKeys(
  records: EntitlementRecord[],
  now: Date = new Date(),
): ServiceKey[] {
  const keys = new Set<ServiceKey>()
  for (const record of records) {
    if (isEntitlementCurrentlyActive(record, now)) {
      keys.add(record.serviceKey)
    }
  }
  return [...keys].sort()
}
