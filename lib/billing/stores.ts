import type {
  EntitlementUpsert,
  ServicePriceMapping,
  StoredEntitlement,
} from "@/lib/billing/types"
import type { ServiceKey } from "@/lib/services/catalog"

export type BillingCustomerRecord = {
  userId: string
  stripeCustomerId: string
  email: string
}

export interface BillingCustomerStore {
  getByUserId(userId: string): Promise<BillingCustomerRecord | null>
  getByStripeCustomerId(stripeCustomerId: string): Promise<BillingCustomerRecord | null>
  upsert(record: BillingCustomerRecord): Promise<BillingCustomerRecord>
}

export interface ServicePriceStore {
  getByServiceKey(serviceKey: ServiceKey): Promise<ServicePriceMapping | null>
  getByStripePriceId(stripePriceId: string): Promise<ServicePriceMapping | null>
  listActiveMappings(): Promise<ServicePriceMapping[]>
}

export interface EntitlementStore {
  getByUserAndService(userId: string, serviceKey: ServiceKey): Promise<StoredEntitlement | null>
  listByUser(userId: string): Promise<StoredEntitlement[]>
  upsert(input: EntitlementUpsert): Promise<StoredEntitlement>
}

export interface WebhookEventStore {
  hasProcessed(eventId: string): Promise<boolean>
  markProcessed(eventId: string, type: string, payloadHash: string): Promise<"inserted" | "duplicate">
}

export type AtomicWebhookCommit = {
  eventId: string
  type: string
  payloadHash: string
  entitlementUpserts: EntitlementUpsert[]
}

export type AtomicWebhookCommitResult = {
  status: "inserted" | "duplicate"
  appliedServiceIds: string[]
}

export interface AtomicWebhookStore {
  commit(input: AtomicWebhookCommit): Promise<AtomicWebhookCommitResult>
}

export type BillingStores = {
  customers: BillingCustomerStore
  prices: ServicePriceStore
  entitlements: EntitlementStore
  webhookEvents: WebhookEventStore
  atomicWebhooks: AtomicWebhookStore
}

export function createMemoryCustomerStore(
  seed: BillingCustomerRecord[] = [],
): BillingCustomerStore {
  const byUser = new Map(seed.map((row) => [row.userId, row]))
  const byCustomer = new Map(seed.map((row) => [row.stripeCustomerId, row]))

  return {
    async getByUserId(userId) {
      return byUser.get(userId) ?? null
    },
    async getByStripeCustomerId(stripeCustomerId) {
      return byCustomer.get(stripeCustomerId) ?? null
    },
    async upsert(record) {
      byUser.set(record.userId, record)
      byCustomer.set(record.stripeCustomerId, record)
      return record
    },
  }
}

export function createMemoryPriceStore(mappings: ServicePriceMapping[]): ServicePriceStore {
  const byService = new Map(mappings.map((row) => [row.serviceKey, row]))
  const byPrice = new Map(mappings.map((row) => [row.stripePriceId, row]))

  return {
    async getByServiceKey(serviceKey) {
      return byService.get(serviceKey) ?? null
    },
    async getByStripePriceId(stripePriceId) {
      return byPrice.get(stripePriceId) ?? null
    },
    async listActiveMappings() {
      return mappings.filter((row) => row.active)
    },
  }
}

export function createMemoryEntitlementStore(
  seed: StoredEntitlement[] = [],
): EntitlementStore & { rows: StoredEntitlement[] } {
  const rows = [...seed]

  return {
    rows,
    async getByUserAndService(userId, serviceKey) {
      return rows.find((row) => row.userId === userId && row.serviceKey === serviceKey) ?? null
    },
    async listByUser(userId) {
      return rows.filter((row) => row.userId === userId)
    },
    async upsert(input) {
      const index = rows.findIndex(
        (row) => row.userId === input.userId && row.serviceKey === input.serviceKey,
      )
      const next: StoredEntitlement = {
        userId: input.userId,
        serviceId: input.serviceId,
        serviceKey: input.serviceKey,
        status: input.status,
        source: input.source,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripeSubscriptionItemId: input.stripeSubscriptionItemId,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        updatedAt: input.eventCreatedAt,
      }
      if (index >= 0) {
        rows[index] = next
      } else {
        rows.push(next)
      }
      return next
    },
  }
}

export function createMemoryWebhookEventStore(): WebhookEventStore & {
  processed: Map<string, { type: string; payloadHash: string }>
} {
  const processed = new Map<string, { type: string; payloadHash: string }>()

  return {
    processed,
    async hasProcessed(eventId) {
      return processed.has(eventId)
    },
    async markProcessed(eventId, type, payloadHash) {
      if (processed.has(eventId)) {
        return "duplicate"
      }
      processed.set(eventId, { type, payloadHash })
      return "inserted"
    },
  }
}

export function createMemoryAtomicWebhookStore(input: {
  entitlements: EntitlementStore & { rows: StoredEntitlement[] }
  webhookEvents: WebhookEventStore & {
    processed: Map<string, { type: string; payloadHash: string }>
  }
  failAfterEntitlements?: () => boolean
}): AtomicWebhookStore {
  let queue = Promise.resolve()

  return {
    async commit(commit) {
      const execute = async (): Promise<AtomicWebhookCommitResult> => {
        if (await input.webhookEvents.hasProcessed(commit.eventId)) {
          return { status: "duplicate", appliedServiceIds: [] }
        }

        const entitlementSnapshot = input.entitlements.rows.map((row) => ({ ...row }))
        const eventSnapshot = new Map(input.webhookEvents.processed)
        const appliedServiceIds: string[] = []
        try {
          for (const upsert of commit.entitlementUpserts) {
            const existing = await input.entitlements.getByUserAndService(
              upsert.userId,
              upsert.serviceKey,
            )
            if (existing && existing.updatedAt > upsert.eventCreatedAt) {
              continue
            }
            if (
              existing &&
              upsert.replaceOnlySubscriptionId &&
              existing.stripeSubscriptionId !== upsert.replaceOnlySubscriptionId
            ) {
              continue
            }
            await input.entitlements.upsert(upsert)
            appliedServiceIds.push(upsert.serviceId)
          }

          if (input.failAfterEntitlements?.()) {
            throw new Error("Simulated failure between entitlement and event writes")
          }

          const marked = await input.webhookEvents.markProcessed(
            commit.eventId,
            commit.type,
            commit.payloadHash,
          )
          if (marked === "duplicate") {
            return { status: "duplicate", appliedServiceIds: [] }
          }
          return { status: "inserted", appliedServiceIds }
        } catch (error) {
          input.entitlements.rows.splice(
            0,
            input.entitlements.rows.length,
            ...entitlementSnapshot,
          )
          input.webhookEvents.processed.clear()
          for (const [key, value] of eventSnapshot) {
            input.webhookEvents.processed.set(key, value)
          }
          throw error
        }
      }

      const result = queue.then(execute, execute)
      queue = result.then(
        () => undefined,
        () => undefined,
      )
      return result
    },
  }
}
