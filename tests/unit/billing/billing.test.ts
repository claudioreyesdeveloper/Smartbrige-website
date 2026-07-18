import { describe, expect, it, vi } from "vitest"
import { createServiceCheckoutSession } from "@/lib/billing/checkout"
import { createNeonAtomicWebhookStore } from "@/lib/billing/drizzle-stores"
import { createBillingPortalSession } from "@/lib/billing/portal"
import { BillingError } from "@/lib/billing/errors"
import { reconcileSubscriptionEntitlements } from "@/lib/billing/reconcile"
import {
  createMemoryAtomicWebhookStore,
  createMemoryCustomerStore,
  createMemoryEntitlementStore,
  createMemoryPriceStore,
  createMemoryWebhookEventStore,
} from "@/lib/billing/stores"
import { isEntitlementCurrentlyActive } from "@/lib/auth/entitlement-logic"
import type { ServicePriceMapping, StripeSubscriptionSnapshot } from "@/lib/billing/types"
import { processStripeWebhook } from "@/lib/billing/webhook"
import {
  BILLING_SERVICE_METADATA_KEY,
  BILLING_USER_METADATA_KEY,
} from "@/lib/billing/types"
import type Stripe from "stripe"

const NOW = new Date("2026-07-18T10:00:00.000Z")

function price(
  partial: Partial<ServicePriceMapping> &
    Pick<ServicePriceMapping, "serviceKey" | "serviceId" | "stripePriceId">,
): ServicePriceMapping {
  return {
    availability: "active",
    stripeProductId: `prod_${partial.serviceKey}`,
    billingInterval: "month",
    active: true,
    ...partial,
  }
}

const ACTIVE_PRICES: ServicePriceMapping[] = [
  price({
    serviceKey: "jam-player",
    serviceId: "svc-jam",
    stripePriceId: "price_jam",
  }),
  price({
    serviceKey: "bass-drums",
    serviceId: "svc-bass",
    stripePriceId: "price_bass",
  }),
  price({
    serviceKey: "solo-phrases",
    serviceId: "svc-solo",
    stripePriceId: "price_solo",
  }),
  price({
    serviceKey: "lyrics",
    serviceId: "svc-lyrics",
    stripePriceId: "price_lyrics",
  }),
  price({
    serviceKey: "genos-mixer",
    serviceId: "svc-mixer",
    stripePriceId: "price_mixer",
  }),
  price({
    serviceKey: "style-maker",
    serviceId: "svc-style",
    stripePriceId: "price_style",
    availability: "future",
    active: false,
  }),
]

function subscriptionSnapshot(
  partial: Partial<StripeSubscriptionSnapshot> &
    Pick<StripeSubscriptionSnapshot, "id" | "items">,
): StripeSubscriptionSnapshot {
  return {
    status: "active",
    customerId: "cus_test",
    cancelAtPeriodEnd: false,
    currentPeriodStart: new Date("2026-07-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
    canceledAt: null,
    created: new Date("2026-07-01T00:00:00.000Z"),
    metadata: {
      [BILLING_USER_METADATA_KEY]: "user-1",
      [BILLING_SERVICE_METADATA_KEY]: partial.items[0]
        ? ACTIVE_PRICES.find((row) => row.stripePriceId === partial.items[0].priceId)
            ?.serviceKey ?? "jam-player"
        : "jam-player",
    },
    ...partial,
  }
}

function fakeStripeEvent(input: {
  id: string
  type: Stripe.Event.Type
  created: number
  object: Stripe.Event.Data["object"]
}): Stripe.Event {
  return {
    id: input.id,
    object: "event",
    api_version: "2026-06-24.dahlia",
    created: input.created,
    type: input.type,
    data: { object: input.object },
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as Stripe.Event
}

function stripeSubscriptionObject(input: {
  id?: string
  status?: Stripe.Subscription.Status
  cancelAtPeriodEnd?: boolean
  periodEnd?: Date
  priceId?: string
  serviceKey?: "jam-player" | "bass-drums"
} = {}): Stripe.Subscription {
  const periodEnd = input.periodEnd ?? new Date(NOW.getTime() + 30 * 24 * 3600 * 1000)
  return {
    id: input.id ?? "sub_jam",
    object: "subscription",
    status: input.status ?? "active",
    customer: "cus_1",
    cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
    canceled_at: null,
    created: Math.floor(NOW.getTime() / 1000),
    metadata: {
      [BILLING_USER_METADATA_KEY]: "user-1",
      [BILLING_SERVICE_METADATA_KEY]: input.serviceKey ?? "jam-player",
    },
    items: {
      object: "list",
      data: [
        {
          id: "si_jam",
          object: "subscription_item",
          created: Math.floor(NOW.getTime() / 1000),
          current_period_start: Math.floor(
            new Date("2026-07-01T00:00:00.000Z").getTime() / 1000,
          ),
          current_period_end: Math.floor(periodEnd.getTime() / 1000),
          metadata: {},
          price: {
            id: input.priceId ?? "price_jam",
            object: "price",
            product: input.serviceKey === "bass-drums" ? "prod_bass-drums" : "prod_jam",
          },
        },
      ],
      has_more: false,
      url: "",
    },
  } as unknown as Stripe.Subscription
}

function createFakeStripe(options?: {
  checkoutUrl?: string
  portalUrl?: string
  customers?: Array<{ id: string; email: string; metadata: Record<string, string> }>
}) {
  const customers = [...(options?.customers ?? [])]
  return {
    customers: {
      list: vi.fn(async ({ email }: { email: string }) => ({
        data: customers.filter((customer) => customer.email === email),
      })),
      create: vi.fn(async ({ email, metadata }: { email: string; metadata: Record<string, string> }) => {
        const created = {
          id: `cus_${customers.length + 1}`,
          email,
          metadata,
        }
        customers.push(created)
        return created
      }),
      retrieve: vi.fn(async (id: string) => {
        const found = customers.find((customer) => customer.id === id)
        if (!found) {
          return { id, deleted: true as const }
        }
        return found
      }),
      update: vi.fn(async () => ({})),
      search: vi.fn(async () => ({ data: [] })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => ({
          id: "cs_test_1",
          url: options?.checkoutUrl ?? "https://checkout.stripe.test/session",
        })),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(async () => ({
          url: options?.portalUrl ?? "https://billing.stripe.test/portal",
        })),
      },
    },
  }
}

describe("billing checkout", () => {
  it("creates an independent subscription checkout per purchasable service", async () => {
    const stripe = createFakeStripe()
    const customers = createMemoryCustomerStore()
    const prices = createMemoryPriceStore(ACTIVE_PRICES)

    const result = await createServiceCheckoutSession(
      { userId: "user-1", email: "a@example.com", serviceKey: "jam-player" },
      {
        stripe: stripe as never,
        prices,
        customers,
        appUrl: "https://app.example",
      },
    )

    expect(result.checkoutUrl).toContain("checkout.stripe.test")
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_jam", quantity: 1 }],
        metadata: expect.objectContaining({
          [BILLING_USER_METADATA_KEY]: "user-1",
          [BILLING_SERVICE_METADATA_KEY]: "jam-player",
        }),
      }),
    )
  })

  it("rejects checkout for unavailable style-maker", async () => {
    const stripe = createFakeStripe()
    await expect(
      createServiceCheckoutSession(
        { userId: "user-1", email: "a@example.com", serviceKey: "style-maker" },
        {
          stripe: stripe as never,
          prices: createMemoryPriceStore(ACTIVE_PRICES),
          customers: createMemoryCustomerStore(),
          appUrl: "https://app.example",
        },
      ),
    ).rejects.toMatchObject({
      name: "BillingError",
      code: "unavailable_service",
    })
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it("rejects unauthorized checkout calls", async () => {
    await expect(
      createServiceCheckoutSession(
        { userId: "", email: "a@example.com", serviceKey: "jam-player" },
        {
          stripe: createFakeStripe() as never,
          prices: createMemoryPriceStore(ACTIVE_PRICES),
          customers: createMemoryCustomerStore(),
          appUrl: "https://app.example",
        },
      ),
    ).rejects.toBeInstanceOf(BillingError)
  })
})

describe("billing portal", () => {
  it("opens the customer portal for a mapped customer", async () => {
    const stripe = createFakeStripe({ portalUrl: "https://billing.stripe.test/session" })
    const customers = createMemoryCustomerStore([
      { userId: "user-1", stripeCustomerId: "cus_1", email: "a@example.com" },
    ])

    const result = await createBillingPortalSession("user-1", {
      stripe: stripe as never,
      customers,
      appUrl: "https://app.example",
    })

    expect(result.portalUrl).toBe("https://billing.stripe.test/session")
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://app.example/app/billing",
    })
  })

  it("rejects unauthorized portal calls", async () => {
    await expect(
      createBillingPortalSession("", {
        stripe: createFakeStripe() as never,
        customers: createMemoryCustomerStore(),
        appUrl: "https://app.example",
      }),
    ).rejects.toMatchObject({ code: "unauthenticated" })
  })
})

describe("entitlement reconciliation", () => {
  it("applies one service without revoking another when canceling", async () => {
    const prices = createMemoryPriceStore(ACTIVE_PRICES)
    const entitlements = createMemoryEntitlementStore([
      {
        userId: "user-1",
        serviceId: "svc-jam",
        serviceKey: "jam-player",
        status: "active",
        source: "stripe",
        stripeSubscriptionId: "sub_jam",
        stripeSubscriptionItemId: "si_jam",
        validFrom: new Date("2026-07-01T00:00:00.000Z"),
        validUntil: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        userId: "user-1",
        serviceId: "svc-mixer",
        serviceKey: "genos-mixer",
        status: "active",
        source: "stripe",
        stripeSubscriptionId: "sub_mixer",
        stripeSubscriptionItemId: "si_mixer",
        validFrom: new Date("2026-07-01T00:00:00.000Z"),
        validUntil: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ])

    await reconcileSubscriptionEntitlements({
      snapshot: subscriptionSnapshot({
        id: "sub_jam",
        status: "canceled",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date("2026-07-10T00:00:00.000Z"),
        items: [{ id: "si_jam", priceId: "price_jam", productId: "prod_jam", metadata: {} }],
        metadata: {
          [BILLING_USER_METADATA_KEY]: "user-1",
          [BILLING_SERVICE_METADATA_KEY]: "jam-player",
        },
      }),
      userId: "user-1",
      eventCreatedAt: new Date("2026-07-18T09:00:00.000Z"),
      prices,
      entitlements,
      now: NOW,
    })

    const jam = await entitlements.getByUserAndService("user-1", "jam-player")
    const mixer = await entitlements.getByUserAndService("user-1", "genos-mixer")
    expect(jam?.status).toBe("expired")
    expect(mixer?.status).toBe("active")
    expect(mixer?.stripeSubscriptionId).toBe("sub_mixer")
  })

  it("keeps cancel-at-period-end access until but not at the exact boundary", async () => {
    const prices = createMemoryPriceStore(ACTIVE_PRICES)
    const entitlements = createMemoryEntitlementStore()
    const periodEnd = new Date("2026-08-01T00:00:00.000Z")

    await reconcileSubscriptionEntitlements({
      snapshot: subscriptionSnapshot({
        id: "sub_jam",
        status: "active",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: periodEnd,
        items: [{ id: "si_jam", priceId: "price_jam", productId: "prod_jam", metadata: {} }],
      }),
      userId: "user-1",
      eventCreatedAt: NOW,
      prices,
      entitlements,
      now: NOW,
    })

    const jam = await entitlements.getByUserAndService("user-1", "jam-player")
    expect(jam?.validUntil).toEqual(periodEnd)
    expect(
      jam &&
        isEntitlementCurrentlyActive(
          jam,
          new Date(periodEnd.getTime() - 1),
        ),
    ).toBe(true)
    expect(jam && isEntitlementCurrentlyActive(jam, periodEnd)).toBe(false)
  })

  it("does not hard-expire an active renewal at its reported period end", async () => {
    const prices = createMemoryPriceStore(ACTIVE_PRICES)
    const entitlements = createMemoryEntitlementStore()
    const periodEnd = new Date("2026-07-15T00:00:00.000Z")

    await reconcileSubscriptionEntitlements({
      snapshot: subscriptionSnapshot({
        id: "sub_jam",
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: periodEnd,
        items: [{ id: "si_jam", priceId: "price_jam", productId: "prod_jam", metadata: {} }],
      }),
      userId: "user-1",
      eventCreatedAt: NOW,
      prices,
      entitlements,
      now: NOW,
    })

    const jam = await entitlements.getByUserAndService("user-1", "jam-player")
    expect(jam?.status).toBe("active")
    expect(jam?.validUntil).toBeNull()
    expect(jam && isEntitlementCurrentlyActive(jam, NOW)).toBe(true)
  })

  it("skips stale out-of-order entitlement updates", async () => {
    const prices = createMemoryPriceStore(ACTIVE_PRICES)
    const entitlements = createMemoryEntitlementStore([
      {
        userId: "user-1",
        serviceId: "svc-jam",
        serviceKey: "jam-player",
        status: "active",
        source: "stripe",
        stripeSubscriptionId: "sub_jam",
        stripeSubscriptionItemId: "si_jam",
        validFrom: new Date("2026-07-01T00:00:00.000Z"),
        validUntil: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-18T12:00:00.000Z"),
      },
    ])

    const result = await reconcileSubscriptionEntitlements({
      snapshot: subscriptionSnapshot({
        id: "sub_jam",
        status: "canceled",
        items: [{ id: "si_jam", priceId: "price_jam", productId: "prod_jam", metadata: {} }],
      }),
      userId: "user-1",
      eventCreatedAt: new Date("2026-07-18T11:00:00.000Z"),
      prices,
      entitlements,
      now: NOW,
    })

    expect(result.skippedStale).toEqual(["jam-player"])
    expect(result.applied).toEqual([])
    const jam = await entitlements.getByUserAndService("user-1", "jam-player")
    expect(jam?.status).toBe("active")
  })

  it("ignores unknown Stripe prices without granting entitlements", async () => {
    const prices = createMemoryPriceStore(ACTIVE_PRICES)
    const entitlements = createMemoryEntitlementStore()

    const result = await reconcileSubscriptionEntitlements({
      snapshot: subscriptionSnapshot({
        id: "sub_unknown",
        items: [
          {
            id: "si_unknown",
            priceId: "price_unknown",
            productId: "prod_unknown",
            metadata: {},
          },
        ],
      }),
      userId: "user-1",
      eventCreatedAt: NOW,
      prices,
      entitlements,
      now: NOW,
    })

    expect(result.skippedUnknownPrice).toEqual(["price_unknown"])
    expect(await entitlements.listByUser("user-1")).toEqual([])
  })
})

describe("stripe webhook processing", () => {
  it("verifies signatures and is durable-idempotent for duplicate events", async () => {
    const prices = createMemoryPriceStore(ACTIVE_PRICES)
    const entitlements = createMemoryEntitlementStore()
    const customers = createMemoryCustomerStore()
    const webhookEvents = createMemoryWebhookEventStore()
    const atomicWebhooks = createMemoryAtomicWebhookStore({
      entitlements,
      webhookEvents,
    })
    const constructEvent = vi.fn(() =>
      fakeStripeEvent({
        id: "evt_1",
        type: "customer.subscription.created",
        created: Math.floor(NOW.getTime() / 1000),
        object: stripeSubscriptionObject(),
      }),
    )

    const deps = {
      customers,
      prices,
      entitlements,
      webhookEvents,
      atomicWebhooks,
      stripeVerifier: { constructEvent },
      webhookSecret: "whsec_test",
      retrieveSubscription: async () => stripeSubscriptionObject(),
      now: NOW,
    }

    const first = await processStripeWebhook({
      payload: '{"id":"evt_1"}',
      signature: "t=1,v1=sig",
      deps,
    })
    const second = await processStripeWebhook({
      payload: '{"id":"evt_1"}',
      signature: "t=1,v1=sig",
      deps,
    })

    expect(first.status).toBe("processed")
    expect(second.status).toBe("duplicate")
    expect(await entitlements.listByUser("user-1")).toHaveLength(1)
    expect(webhookEvents.processed.has("evt_1")).toBe(true)
  })

  it("converges same-second active and deleted events in either delivery order", async () => {
    async function run(order: Array<"active" | "deleted">) {
      const entitlements = createMemoryEntitlementStore()
      const webhookEvents = createMemoryWebhookEventStore()
      const authoritative = stripeSubscriptionObject({ status: "canceled" })
      const events = {
        active: fakeStripeEvent({
          id: "evt_same_second_active",
          type: "customer.subscription.updated",
          created: Math.floor(NOW.getTime() / 1000),
          object: stripeSubscriptionObject({ status: "active" }),
        }),
        deleted: fakeStripeEvent({
          id: "evt_same_second_deleted",
          type: "customer.subscription.deleted",
          created: Math.floor(NOW.getTime() / 1000),
          object: stripeSubscriptionObject({ status: "canceled" }),
        }),
      }
      const deps = {
        customers: createMemoryCustomerStore(),
        prices: createMemoryPriceStore(ACTIVE_PRICES),
        entitlements,
        webhookEvents,
        atomicWebhooks: createMemoryAtomicWebhookStore({
          entitlements,
          webhookEvents,
        }),
        stripeVerifier: {
          constructEvent: (payload: string | Buffer) =>
            events[JSON.parse(payload.toString()).kind as keyof typeof events],
        },
        webhookSecret: "whsec_test",
        retrieveSubscription: async () => authoritative,
        now: NOW,
      }

      for (const kind of order) {
        await processStripeWebhook({
          payload: JSON.stringify({ kind }),
          signature: "t=1,v1=sig",
          deps,
        })
      }
      return entitlements.getByUserAndService("user-1", "jam-player")
    }

    const activeThenDeleted = await run(["active", "deleted"])
    const deletedThenActive = await run(["deleted", "active"])
    expect(activeThenDeleted?.status).toBe("canceled")
    expect(deletedThenActive?.status).toBe("canceled")
    expect(activeThenDeleted && isEntitlementCurrentlyActive(activeThenDeleted, NOW)).toBe(false)
    expect(deletedThenActive && isEntitlementCurrentlyActive(deletedThenActive, NOW)).toBe(false)
    expect(activeThenDeleted?.stripeSubscriptionId).toBe("sub_jam")
    expect(deletedThenActive?.stripeSubscriptionId).toBe("sub_jam")
  })

  it("reconciles one subscription from authoritative active to canceled state", async () => {
    const entitlements = createMemoryEntitlementStore()
    const webhookEvents = createMemoryWebhookEventStore()
    let authoritative = stripeSubscriptionObject({ status: "active" })
    let event = fakeStripeEvent({
      id: "evt_active_state",
      type: "customer.subscription.updated",
      created: Math.floor(NOW.getTime() / 1000),
      object: stripeSubscriptionObject({ status: "active" }),
    })
    const deps = {
      customers: createMemoryCustomerStore(),
      prices: createMemoryPriceStore(ACTIVE_PRICES),
      entitlements,
      webhookEvents,
      atomicWebhooks: createMemoryAtomicWebhookStore({
        entitlements,
        webhookEvents,
      }),
      stripeVerifier: { constructEvent: () => event },
      webhookSecret: "whsec_test",
      retrieveSubscription: async () => authoritative,
      now: NOW,
    }

    await processStripeWebhook({
      payload: '{"state":"active"}',
      signature: "t=1,v1=sig",
      deps,
    })
    expect(
      (await entitlements.getByUserAndService("user-1", "jam-player"))?.status,
    ).toBe("active")

    authoritative = stripeSubscriptionObject({ status: "canceled" })
    event = fakeStripeEvent({
      id: "evt_canceled_state",
      type: "customer.subscription.deleted",
      created: Math.floor(NOW.getTime() / 1000),
      object: stripeSubscriptionObject({ status: "active" }),
    })
    await processStripeWebhook({
      payload: '{"state":"canceled"}',
      signature: "t=1,v1=sig",
      deps,
    })
    expect(
      (await entitlements.getByUserAndService("user-1", "jam-player"))?.status,
    ).toBe("canceled")
  })

  it("does not let an old subscription cancellation revoke its replacement", async () => {
    const entitlements = createMemoryEntitlementStore([
      {
        userId: "user-1",
        serviceId: "svc-jam",
        serviceKey: "jam-player",
        status: "active",
        source: "stripe",
        stripeSubscriptionId: "sub_replacement",
        stripeSubscriptionItemId: "si_jam",
        validFrom: new Date("2026-07-01T00:00:00.000Z"),
        validUntil: null,
        updatedAt: NOW,
      },
    ])
    const webhookEvents = createMemoryWebhookEventStore()
    const oldCanceled = stripeSubscriptionObject({
      id: "sub_old",
      status: "canceled",
    })
    const event = fakeStripeEvent({
      id: "evt_old_cancel",
      type: "customer.subscription.deleted",
      created: Math.floor(NOW.getTime() / 1000),
      object: oldCanceled,
    })

    const result = await processStripeWebhook({
      payload: '{"id":"evt_old_cancel"}',
      signature: "t=1,v1=sig",
      deps: {
        customers: createMemoryCustomerStore(),
        prices: createMemoryPriceStore(ACTIVE_PRICES),
        entitlements,
        webhookEvents,
        atomicWebhooks: createMemoryAtomicWebhookStore({
          entitlements,
          webhookEvents,
        }),
        stripeVerifier: { constructEvent: () => event },
        webhookSecret: "whsec_test",
        retrieveSubscription: async () => null,
        now: NOW,
      },
    })

    const jam = await entitlements.getByUserAndService("user-1", "jam-player")
    expect(result).toMatchObject({ status: "processed", applied: [] })
    expect(jam?.status).toBe("active")
    expect(jam?.stripeSubscriptionId).toBe("sub_replacement")
  })

  it("leaves a failed authoritative retrieval unclaimed so Stripe can retry", async () => {
    const entitlements = createMemoryEntitlementStore()
    const webhookEvents = createMemoryWebhookEventStore()
    const event = fakeStripeEvent({
      id: "evt_retrieve_retry",
      type: "customer.subscription.updated",
      created: Math.floor(NOW.getTime() / 1000),
      object: stripeSubscriptionObject(),
    })
    let fail = true
    const deps = {
      customers: createMemoryCustomerStore(),
      prices: createMemoryPriceStore(ACTIVE_PRICES),
      entitlements,
      webhookEvents,
      atomicWebhooks: createMemoryAtomicWebhookStore({
        entitlements,
        webhookEvents,
      }),
      stripeVerifier: { constructEvent: () => event },
      webhookSecret: "whsec_test",
      retrieveSubscription: async () => {
        if (fail) {
          throw new Error("Stripe retrieval unavailable")
        }
        return stripeSubscriptionObject()
      },
      now: NOW,
    }

    await expect(
      processStripeWebhook({
        payload: '{"id":"evt_retrieve_retry"}',
        signature: "t=1,v1=sig",
        deps,
      }),
    ).rejects.toThrow("Stripe retrieval unavailable")
    expect(webhookEvents.processed.has("evt_retrieve_retry")).toBe(false)
    expect(await entitlements.listByUser("user-1")).toEqual([])

    fail = false
    const retried = await processStripeWebhook({
      payload: '{"id":"evt_retrieve_retry"}',
      signature: "t=1,v1=sig",
      deps,
    })
    expect(retried.status).toBe("processed")
    expect(webhookEvents.processed.has("evt_retrieve_retry")).toBe(true)
  })

  it("revokes only the canceled service and leaves other services untouched", async () => {
    const entitlements = createMemoryEntitlementStore([
      {
        userId: "user-1",
        serviceId: "svc-jam",
        serviceKey: "jam-player",
        status: "active",
        source: "stripe",
        stripeSubscriptionId: "sub_jam",
        stripeSubscriptionItemId: "si_jam",
        validFrom: new Date("2026-07-01T00:00:00.000Z"),
        validUntil: null,
        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        userId: "user-1",
        serviceId: "svc-bass",
        serviceKey: "bass-drums",
        status: "active",
        source: "stripe",
        stripeSubscriptionId: "sub_bass",
        stripeSubscriptionItemId: "si_bass",
        validFrom: new Date("2026-07-01T00:00:00.000Z"),
        validUntil: null,
        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ])
    const webhookEvents = createMemoryWebhookEventStore()
    const canceled = stripeSubscriptionObject({ status: "canceled" })
    const event = fakeStripeEvent({
      id: "evt_jam_only",
      type: "customer.subscription.deleted",
      created: Math.floor(NOW.getTime() / 1000),
      object: canceled,
    })

    await processStripeWebhook({
      payload: '{"id":"evt_jam_only"}',
      signature: "t=1,v1=sig",
      deps: {
        customers: createMemoryCustomerStore(),
        prices: createMemoryPriceStore(ACTIVE_PRICES),
        entitlements,
        webhookEvents,
        atomicWebhooks: createMemoryAtomicWebhookStore({
          entitlements,
          webhookEvents,
        }),
        stripeVerifier: { constructEvent: () => event },
        webhookSecret: "whsec_test",
        retrieveSubscription: async () => canceled,
        now: NOW,
      },
    })

    expect(
      (await entitlements.getByUserAndService("user-1", "jam-player"))?.status,
    ).toBe("canceled")
    expect(
      (await entitlements.getByUserAndService("user-1", "bass-drums"))?.status,
    ).toBe("active")
  })

  it("keeps access when an active renewal webhook arrives after the old period boundary", async () => {
    const entitlements = createMemoryEntitlementStore()
    const webhookEvents = createMemoryWebhookEventStore()
    const event = fakeStripeEvent({
      id: "evt_delayed_renewal",
      type: "customer.subscription.updated",
      created: Math.floor(NOW.getTime() / 1000),
      object: stripeSubscriptionObject({
        status: "active",
        cancelAtPeriodEnd: false,
        periodEnd: new Date("2026-07-15T00:00:00.000Z"),
      }),
    })

    const result = await processStripeWebhook({
      payload: '{"id":"evt_delayed_renewal"}',
      signature: "t=1,v1=sig",
      deps: {
        customers: createMemoryCustomerStore(),
        prices: createMemoryPriceStore(ACTIVE_PRICES),
        entitlements,
        webhookEvents,
        atomicWebhooks: createMemoryAtomicWebhookStore({
          entitlements,
          webhookEvents,
        }),
        stripeVerifier: { constructEvent: () => event },
        webhookSecret: "whsec_test",
        retrieveSubscription: async () => event.data.object as Stripe.Subscription,
        now: NOW,
      },
    })

    const jam = await entitlements.getByUserAndService("user-1", "jam-player")
    expect(result.status).toBe("processed")
    expect(jam?.status).toBe("active")
    expect(jam?.validUntil).toBeNull()
    expect(jam && isEntitlementCurrentlyActive(jam, NOW)).toBe(true)
  })

  it("rolls back entitlement writes when atomic processing fails before event commit", async () => {
    const entitlements = createMemoryEntitlementStore()
    const webhookEvents = createMemoryWebhookEventStore()
    let fail = true
    const atomicWebhooks = createMemoryAtomicWebhookStore({
      entitlements,
      webhookEvents,
      failAfterEntitlements: () => fail,
    })
    const event = fakeStripeEvent({
      id: "evt_retry",
      type: "customer.subscription.created",
      created: Math.floor(NOW.getTime() / 1000),
      object: stripeSubscriptionObject(),
    })
    const deps = {
      customers: createMemoryCustomerStore(),
      prices: createMemoryPriceStore(ACTIVE_PRICES),
      entitlements,
      webhookEvents,
      atomicWebhooks,
      stripeVerifier: { constructEvent: () => event },
      webhookSecret: "whsec_test",
      retrieveSubscription: async () => event.data.object as Stripe.Subscription,
      now: NOW,
    }

    await expect(
      processStripeWebhook({
        payload: '{"id":"evt_retry"}',
        signature: "t=1,v1=sig",
        deps,
      }),
    ).rejects.toThrow(/between entitlement and event writes/)
    expect(await entitlements.listByUser("user-1")).toEqual([])
    expect(webhookEvents.processed.has("evt_retry")).toBe(false)

    fail = false
    const retried = await processStripeWebhook({
      payload: '{"id":"evt_retry"}',
      signature: "t=1,v1=sig",
      deps,
    })
    expect(retried.status).toBe("processed")
    expect(await entitlements.listByUser("user-1")).toHaveLength(1)
    expect(webhookEvents.processed.has("evt_retry")).toBe(true)
  })

  it("allows exactly one concurrent duplicate to claim and apply the event", async () => {
    const entitlements = createMemoryEntitlementStore()
    const webhookEvents = createMemoryWebhookEventStore()
    const event = fakeStripeEvent({
      id: "evt_concurrent",
      type: "customer.subscription.created",
      created: Math.floor(NOW.getTime() / 1000),
      object: stripeSubscriptionObject(),
    })
    const deps = {
      customers: createMemoryCustomerStore(),
      prices: createMemoryPriceStore(ACTIVE_PRICES),
      entitlements,
      webhookEvents,
      atomicWebhooks: createMemoryAtomicWebhookStore({
        entitlements,
        webhookEvents,
      }),
      stripeVerifier: { constructEvent: () => event },
      webhookSecret: "whsec_test",
      retrieveSubscription: async () => event.data.object as Stripe.Subscription,
      now: NOW,
    }

    const results = await Promise.all([
      processStripeWebhook({
        payload: '{"id":"evt_concurrent"}',
        signature: "t=1,v1=sig",
        deps,
      }),
      processStripeWebhook({
        payload: '{"id":"evt_concurrent"}',
        signature: "t=1,v1=sig",
        deps,
      }),
    ])

    expect(results.map((result) => result.status).sort()).toEqual([
      "duplicate",
      "processed",
    ])
    expect(await entitlements.listByUser("user-1")).toHaveLength(1)
    expect(webhookEvents.processed.size).toBe(1)
  })

  it("rejects webhook calls without a valid signature", async () => {
    const entitlements = createMemoryEntitlementStore()
    const webhookEvents = createMemoryWebhookEventStore()
    await expect(
      processStripeWebhook({
        payload: "{}",
        signature: null,
        deps: {
          customers: createMemoryCustomerStore(),
          prices: createMemoryPriceStore(ACTIVE_PRICES),
          entitlements,
          webhookEvents,
          atomicWebhooks: createMemoryAtomicWebhookStore({
            entitlements,
            webhookEvents,
          }),
          stripeVerifier: {
            constructEvent: () => {
              throw new Error("No signatures found matching the expected signature for payload")
            },
          },
          webhookSecret: "whsec_test",
          retrieveSubscription: async () => stripeSubscriptionObject(),
        },
      }),
    ).rejects.toThrow(/signature/i)
  })
})

describe("Neon atomic webhook persistence", () => {
  it("gates entitlement upserts on the event claim in one PostgreSQL statement", async () => {
    const query = vi.fn(async (_statement: string, _params?: unknown[]) => [
      { claimed: true, service_ids: ["svc-jam"] },
    ])
    const atomic = createNeonAtomicWebhookStore({ query } as never)

    const result = await atomic.commit({
      eventId: "evt_atomic",
      type: "customer.subscription.updated",
      payloadHash: "hash",
      entitlementUpserts: [
        {
          userId: "user-1",
          serviceId: "svc-jam",
          serviceKey: "jam-player",
          status: "active",
          source: "stripe",
          stripeSubscriptionId: "sub_jam",
          stripeSubscriptionItemId: "si_jam",
          validFrom: new Date("2026-07-01T00:00:00.000Z"),
          validUntil: null,
          eventCreatedAt: NOW,
          replaceOnlySubscriptionId: null,
        },
      ],
    })

    expect(query).toHaveBeenCalledTimes(1)
    const statement = query.mock.calls[0]?.[0] as string
    expect(statement).toMatch(/WITH claimed AS/)
    expect(statement).toMatch(/ON CONFLICT \(id\) DO NOTHING/)
    expect(statement).toMatch(/CROSS JOIN claimed/)
    expect(statement).toMatch(/updated_at <= EXCLUDED\.updated_at/)
    expect(result).toEqual({
      status: "inserted",
      appliedServiceIds: ["svc-jam"],
    })
  })
})
