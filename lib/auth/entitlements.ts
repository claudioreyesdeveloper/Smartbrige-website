import { and, eq, isNull } from "drizzle-orm"
import {
  isEntitlementCurrentlyActive,
  listActiveServiceKeys,
  userHasServiceAccess,
  type EntitlementRecord,
} from "@/lib/auth/entitlement-logic"
import { AuthorizationError } from "@/lib/auth/owner"
import { getDb } from "@/lib/db"
import { blobReferences, projects, services, stripeWebhookEvents, userEntitlements } from "@/lib/db/schema"
import type { ServiceKey } from "@/lib/db/services"
import { isServiceKey } from "@/lib/db/services"

export type { EntitlementRecord }

export async function getEntitlementRecordsForUser(userId: string): Promise<EntitlementRecord[]> {
  const db = getDb()
  const rows = await db
    .select({
      grantId: userEntitlements.id,
      serviceKey: services.key,
      status: userEntitlements.status,
      validFrom: userEntitlements.validFrom,
      validUntil: userEntitlements.validUntil,
    })
    .from(userEntitlements)
    .innerJoin(services, eq(userEntitlements.serviceId, services.id))
    .where(eq(userEntitlements.userId, userId))

  return rows.flatMap((row) => {
    if (!isServiceKey(row.serviceKey)) {
      return []
    }
    return [
      {
        grantId: row.grantId,
        serviceKey: row.serviceKey,
        status: row.status,
        validFrom: row.validFrom,
        validUntil: row.validUntil,
      },
    ]
  })
}

export async function userHasEntitlement(userId: string, serviceKey: ServiceKey): Promise<boolean> {
  const records = await getEntitlementRecordsForUser(userId)
  return userHasServiceAccess(records, serviceKey)
}

export async function listActiveEntitlementsForUser(userId: string): Promise<ServiceKey[]> {
  const records = await getEntitlementRecordsForUser(userId)
  return listActiveServiceKeys(records)
}

export async function requireServiceEntitlement(
  userId: string,
  serviceKey: ServiceKey,
): Promise<void> {
  const hasAccess = await userHasEntitlement(userId, serviceKey)
  if (!hasAccess) {
    throw new AuthorizationError("forbidden", `Service entitlement required: ${serviceKey}`)
  }
}

export async function getActiveEntitlementForService(
  userId: string,
  serviceKey: ServiceKey,
): Promise<EntitlementRecord | null> {
  const records = await getEntitlementRecordsForUser(userId)
  return (
    records.find(
      (record) => record.serviceKey === serviceKey && isEntitlementCurrentlyActive(record),
    ) ?? null
  )
}

export async function isStripeWebhookProcessed(eventId: string): Promise<boolean> {
  const db = getDb()
  const row = await db.query.stripeWebhookEvents.findFirst({
    where: (events, { eq: equals }) => equals(events.id, eventId),
    columns: { id: true },
  })
  return Boolean(row)
}

export async function markStripeWebhookProcessed(
  eventId: string,
  type: string,
  payloadHash: string,
): Promise<void> {
  const db = getDb()
  await db
    .insert(stripeWebhookEvents)
    .values({ id: eventId, type, payloadHash })
    .onConflictDoNothing()
}

export async function getProjectOwnerId(projectId: string): Promise<string | null> {
  const db = getDb()
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), isNull(projects.deletedAt)),
    columns: { userId: true },
  })
  return project?.userId ?? null
}

export async function requireProjectOwner(userId: string, projectId: string): Promise<string> {
  const ownerId = await getProjectOwnerId(projectId)
  if (!ownerId) {
    throw new AuthorizationError("not_found", "Project was not found.")
  }
  if (ownerId !== userId) {
    throw new AuthorizationError("forbidden", "You do not own this project.")
  }
  return ownerId
}

export async function requireBlobOwner(userId: string, blobReferenceId: string): Promise<void> {
  const db = getDb()
  const blob = await db.query.blobReferences.findFirst({
    where: eq(blobReferences.id, blobReferenceId),
    columns: { userId: true },
  })
  if (!blob) {
    throw new AuthorizationError("not_found", "Blob reference was not found.")
  }
  if (blob.userId !== userId) {
    throw new AuthorizationError("forbidden", "You do not own this blob reference.")
  }
}
