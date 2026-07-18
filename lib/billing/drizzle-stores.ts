import { and, eq } from "drizzle-orm"
import { neon, type NeonQueryFunction } from "@neondatabase/serverless"
import { getDatabaseUrl, getDb, type AppDatabase } from "@/lib/db"
import {
  servicePrices,
  services,
  stripeWebhookEvents,
  userEntitlements,
} from "@/lib/db/schema"
import { isServiceKey, type ServiceKey } from "@/lib/services/catalog"
import type {
  AtomicWebhookStore,
  BillingCustomerStore,
  EntitlementStore,
  ServicePriceStore,
  WebhookEventStore,
} from "@/lib/billing/stores"
import type { ServicePriceMapping, StoredEntitlement } from "@/lib/billing/types"
import { BILLING_USER_METADATA_KEY } from "@/lib/billing/types"
import type Stripe from "stripe"

type PriceJoinRow = {
  serviceId: string
  serviceKey: string
  availability: "active" | "future"
  stripeProductId: string
  stripePriceId: string
  billingInterval: string
  active: boolean
}

function toMapping(row: PriceJoinRow): ServicePriceMapping | null {
  if (!isServiceKey(row.serviceKey)) {
    return null
  }
  return {
    serviceKey: row.serviceKey,
    serviceId: row.serviceId,
    availability: row.availability,
    stripeProductId: row.stripeProductId,
    stripePriceId: row.stripePriceId,
    billingInterval: row.billingInterval,
    active: row.active,
  }
}

export function createDrizzlePriceStore(db: AppDatabase = getDb()): ServicePriceStore {
  return {
    async getByServiceKey(serviceKey) {
      const rows = await db
        .select({
          serviceId: services.id,
          serviceKey: services.key,
          availability: services.availability,
          stripeProductId: servicePrices.stripeProductId,
          stripePriceId: servicePrices.stripePriceId,
          billingInterval: servicePrices.billingInterval,
          active: servicePrices.active,
        })
        .from(servicePrices)
        .innerJoin(services, eq(servicePrices.serviceId, services.id))
        .where(and(eq(services.key, serviceKey), eq(servicePrices.active, true)))
        .limit(1)
      const row = rows[0]
      return row ? toMapping(row) : null
    },
    async getByStripePriceId(stripePriceId) {
      const rows = await db
        .select({
          serviceId: services.id,
          serviceKey: services.key,
          availability: services.availability,
          stripeProductId: servicePrices.stripeProductId,
          stripePriceId: servicePrices.stripePriceId,
          billingInterval: servicePrices.billingInterval,
          active: servicePrices.active,
        })
        .from(servicePrices)
        .innerJoin(services, eq(servicePrices.serviceId, services.id))
        .where(eq(servicePrices.stripePriceId, stripePriceId))
        .limit(1)
      const row = rows[0]
      return row ? toMapping(row) : null
    },
    async listActiveMappings() {
      const rows = await db
        .select({
          serviceId: services.id,
          serviceKey: services.key,
          availability: services.availability,
          stripeProductId: servicePrices.stripeProductId,
          stripePriceId: servicePrices.stripePriceId,
          billingInterval: servicePrices.billingInterval,
          active: servicePrices.active,
        })
        .from(servicePrices)
        .innerJoin(services, eq(servicePrices.serviceId, services.id))
        .where(eq(servicePrices.active, true))
      return rows.flatMap((row) => {
        const mapping = toMapping(row)
        return mapping ? [mapping] : []
      })
    },
  }
}

export function createDrizzleEntitlementStore(db: AppDatabase = getDb()): EntitlementStore {
  async function hydrate(
    userId: string,
    serviceKey: ServiceKey,
  ): Promise<StoredEntitlement | null> {
    const rows = await db
      .select({
        userId: userEntitlements.userId,
        serviceId: userEntitlements.serviceId,
        serviceKey: services.key,
        status: userEntitlements.status,
        source: userEntitlements.source,
        stripeSubscriptionId: userEntitlements.stripeSubscriptionId,
        stripeSubscriptionItemId: userEntitlements.stripeSubscriptionItemId,
        validFrom: userEntitlements.validFrom,
        validUntil: userEntitlements.validUntil,
        updatedAt: userEntitlements.updatedAt,
      })
      .from(userEntitlements)
      .innerJoin(services, eq(userEntitlements.serviceId, services.id))
      .where(and(eq(userEntitlements.userId, userId), eq(services.key, serviceKey)))
      .limit(1)
    const row = rows[0]
    if (!row || !isServiceKey(row.serviceKey)) {
      return null
    }
    return {
      userId: row.userId,
      serviceId: row.serviceId,
      serviceKey: row.serviceKey,
      status: row.status,
      source: row.source,
      stripeSubscriptionId: row.stripeSubscriptionId,
      stripeSubscriptionItemId: row.stripeSubscriptionItemId,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      updatedAt: row.updatedAt,
    }
  }

  return {
    async getByUserAndService(userId, serviceKey) {
      return hydrate(userId, serviceKey)
    },
    async listByUser(userId) {
      const rows = await db
        .select({
          userId: userEntitlements.userId,
          serviceId: userEntitlements.serviceId,
          serviceKey: services.key,
          status: userEntitlements.status,
          source: userEntitlements.source,
          stripeSubscriptionId: userEntitlements.stripeSubscriptionId,
          stripeSubscriptionItemId: userEntitlements.stripeSubscriptionItemId,
          validFrom: userEntitlements.validFrom,
          validUntil: userEntitlements.validUntil,
          updatedAt: userEntitlements.updatedAt,
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
            userId: row.userId,
            serviceId: row.serviceId,
            serviceKey: row.serviceKey,
            status: row.status,
            source: row.source,
            stripeSubscriptionId: row.stripeSubscriptionId,
            stripeSubscriptionItemId: row.stripeSubscriptionItemId,
            validFrom: row.validFrom,
            validUntil: row.validUntil,
            updatedAt: row.updatedAt,
          },
        ]
      })
    },
    async upsert(input) {
      await db
        .insert(userEntitlements)
        .values({
          userId: input.userId,
          serviceId: input.serviceId,
          status: input.status,
          source: input.source,
          stripeSubscriptionId: input.stripeSubscriptionId,
          stripeSubscriptionItemId: input.stripeSubscriptionItemId,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
          updatedAt: input.eventCreatedAt,
        })
        .onConflictDoUpdate({
          target: [userEntitlements.userId, userEntitlements.serviceId],
          set: {
            status: input.status,
            source: input.source,
            stripeSubscriptionId: input.stripeSubscriptionId,
            stripeSubscriptionItemId: input.stripeSubscriptionItemId,
            validFrom: input.validFrom,
            validUntil: input.validUntil,
            updatedAt: input.eventCreatedAt,
          },
        })

      const stored = await hydrate(input.userId, input.serviceKey)
      if (!stored) {
        throw new Error("Failed to persist entitlement upsert.")
      }
      return stored
    },
  }
}

export function createDrizzleWebhookEventStore(
  db: AppDatabase = getDb(),
): WebhookEventStore {
  return {
    async hasProcessed(eventId) {
      const row = await db.query.stripeWebhookEvents.findFirst({
        where: (events, { eq: equals }) => equals(events.id, eventId),
        columns: { id: true },
      })
      return Boolean(row)
    },
    async markProcessed(eventId, type, payloadHash) {
      const inserted = await db
        .insert(stripeWebhookEvents)
        .values({ id: eventId, type, payloadHash })
        .onConflictDoNothing()
        .returning({ id: stripeWebhookEvents.id })
      return inserted.length > 0 ? "inserted" : "duplicate"
    },
  }
}

type AtomicCommitRow = {
  claimed: boolean
  service_ids: string[] | null
}

/**
 * Claims the webhook event and applies all entitlement changes in one
 * PostgreSQL statement. The data-modifying CTE gates every upsert on the
 * successful event insert, so a concurrent duplicate cannot write.
 */
export function createNeonAtomicWebhookStore(
  sql: NeonQueryFunction<false, false> = neon(getDatabaseUrl()),
): AtomicWebhookStore {
  return {
    async commit(input) {
      const params: unknown[] = [input.eventId, input.type, input.payloadHash]

      if (input.entitlementUpserts.length === 0) {
        const rows = await sql.query(
          `WITH claimed AS (
             INSERT INTO stripe_webhook_events (id, type, payload_hash)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO NOTHING
             RETURNING id
           )
           SELECT EXISTS(SELECT 1 FROM claimed) AS claimed,
                  ARRAY[]::text[] AS service_ids`,
          params,
        ) as AtomicCommitRow[]
        return {
          status: rows[0]?.claimed ? "inserted" : "duplicate",
          appliedServiceIds: [],
        }
      }

      const valueGroups = input.entitlementUpserts.map((upsert) => {
        const start = params.length + 1
        params.push(
          upsert.userId,
          upsert.serviceId,
          upsert.status,
          upsert.source,
          upsert.stripeSubscriptionId,
          upsert.stripeSubscriptionItemId,
          upsert.validFrom.toISOString(),
          upsert.validUntil?.toISOString() ?? null,
          upsert.eventCreatedAt.toISOString(),
        )
        return `($${start}, $${start + 1}, $${start + 2}::entitlement_status,
          $${start + 3}::entitlement_source, $${start + 4}, $${start + 5},
          $${start + 6}::timestamp, $${start + 7}::timestamp,
          $${start + 8}::timestamp)`
      })

      const rows = await sql.query(
        `WITH claimed AS (
           INSERT INTO stripe_webhook_events (id, type, payload_hash)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING
           RETURNING id
         ),
         incoming (
           user_id, service_id, status, source,
           stripe_subscription_id, stripe_subscription_item_id,
           valid_from, valid_until, updated_at
         ) AS (
           VALUES ${valueGroups.join(", ")}
         ),
         applied AS (
           INSERT INTO user_entitlements (
             user_id, service_id, status, source,
             stripe_subscription_id, stripe_subscription_item_id,
             valid_from, valid_until, updated_at
           )
           SELECT incoming.*
           FROM incoming
           CROSS JOIN claimed
           WHERE true
           ON CONFLICT (user_id, service_id) DO UPDATE SET
             status = EXCLUDED.status,
             source = EXCLUDED.source,
             stripe_subscription_id = EXCLUDED.stripe_subscription_id,
             stripe_subscription_item_id = EXCLUDED.stripe_subscription_item_id,
             valid_from = EXCLUDED.valid_from,
             valid_until = EXCLUDED.valid_until,
             updated_at = EXCLUDED.updated_at
           WHERE user_entitlements.updated_at <= EXCLUDED.updated_at
           RETURNING service_id
         )
         SELECT EXISTS(SELECT 1 FROM claimed) AS claimed,
                COALESCE(
                  (SELECT array_agg(service_id) FROM applied),
                  ARRAY[]::text[]
                ) AS service_ids`,
        params,
      ) as AtomicCommitRow[]

      return {
        status: rows[0]?.claimed ? "inserted" : "duplicate",
        appliedServiceIds: rows[0]?.service_ids ?? [],
      }
    },
  }
}

/**
 * Durable customer mapping without a local customers table: Stripe Customer
 * metadata (`smartbridge_user_id`) is the source of truth. An in-process cache
 * reduces repeat lookups within a single invocation.
 */
export function createStripeMetadataCustomerStore(
  stripe: Pick<Stripe, "customers">,
): BillingCustomerStore {
  const byUser = new Map<string, { userId: string; stripeCustomerId: string; email: string }>()
  const byCustomer = new Map<
    string,
    { userId: string; stripeCustomerId: string; email: string }
  >()

  return {
    async getByUserId(userId) {
      const cached = byUser.get(userId)
      if (cached) {
        return cached
      }

      try {
        const search = await stripe.customers.search({
          query: `metadata["${BILLING_USER_METADATA_KEY}"]:"${userId}"`,
          limit: 1,
        })
        const customer = search.data[0]
        if (!customer) {
          return null
        }
        const record = {
          userId,
          stripeCustomerId: customer.id,
          email: customer.email ?? "",
        }
        byUser.set(userId, record)
        byCustomer.set(customer.id, record)
        return record
      } catch {
        return null
      }
    },
    async getByStripeCustomerId(stripeCustomerId) {
      const cached = byCustomer.get(stripeCustomerId)
      if (cached) {
        return cached
      }
      const customer = await stripe.customers.retrieve(stripeCustomerId)
      if (customer.deleted) {
        return null
      }
      const userId = customer.metadata?.[BILLING_USER_METADATA_KEY]
      if (!userId) {
        return null
      }
      const record = {
        userId,
        stripeCustomerId: customer.id,
        email: customer.email ?? "",
      }
      byUser.set(userId, record)
      byCustomer.set(customer.id, record)
      return record
    },
    async upsert(record) {
      byUser.set(record.userId, record)
      byCustomer.set(record.stripeCustomerId, record)
      try {
        await stripe.customers.update(record.stripeCustomerId, {
          metadata: {
            [BILLING_USER_METADATA_KEY]: record.userId,
          },
          ...(record.email ? { email: record.email } : {}),
        })
      } catch {
        // Mapping is still held in-process for this invocation.
      }
      return record
    },
  }
}
