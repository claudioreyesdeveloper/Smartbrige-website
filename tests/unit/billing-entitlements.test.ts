import { afterEach, describe, expect, it, vi } from "vitest"
import {
  PLAN_ENTITLEMENTS,
  getJamPlayerEntitlement,
  userHasProduct,
  type Plan,
} from "@/lib/billing/entitlements"

const requireDb = vi.fn()

vi.mock("@/lib/db", () => ({
  requireDb: (...args: unknown[]) => requireDb(...args),
}))

// `clerkConfigured` in lib/billing/entitlements.ts is a module-level const
// evaluated once from whatever NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/
// CLERK_SECRET_KEY happen to be set in the process running the tests — env
// stubs applied inside a test body run too late to affect it. Mock `auth`
// directly so the anonymous-user case is deterministic either way.
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
}))

/** Fake drizzle query chain: db.select().from().where().limit() -> rows */
function fakeDb(rows: unknown[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(rows),
        }),
      }),
    }),
  }
}

function subscriptionRow(overrides: { status: string; plan: Plan }) {
  return {
    id: "sub_1",
    userId: "user_1",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    stripePriceId: "price_1",
    status: overrides.status,
    plan: overrides.plan,
    currentPeriodEnd: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  requireDb.mockReset()
  vi.restoreAllMocks()
})

describe("PLAN_ENTITLEMENTS", () => {
  it("maps each plan tier to exactly the products it unlocks", () => {
    expect(PLAN_ENTITLEMENTS.style_maker).toEqual(["style-maker"])
    expect(PLAN_ENTITLEMENTS.jam_player).toEqual(["jam-player"])
    expect(PLAN_ENTITLEMENTS.all_access).toEqual(["style-maker", "jam-player"])
  })

  it("makes all_access a strict superset of the single-product plans", () => {
    for (const product of PLAN_ENTITLEMENTS.style_maker) {
      expect(PLAN_ENTITLEMENTS.all_access).toContain(product)
    }
    for (const product of PLAN_ENTITLEMENTS.jam_player) {
      expect(PLAN_ENTITLEMENTS.all_access).toContain(product)
    }
  })
})

describe("userHasProduct", () => {
  it("returns false with no subscription row, without hitting the dev bypass", () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abc")
    vi.stubEnv("DATABASE_URL", "postgres://x")
    requireDb.mockReturnValue(fakeDb([]))
    return expect(userHasProduct("user_1", "style-maker")).resolves.toBe(false)
  })

  it("returns false for an inactive/canceled subscription regardless of plan", async () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abc")
    vi.stubEnv("DATABASE_URL", "postgres://x")
    requireDb.mockReturnValue(
      fakeDb([subscriptionRow({ status: "canceled", plan: "all_access" })]),
    )
    expect(await userHasProduct("user_1", "style-maker")).toBe(false)
    expect(await userHasProduct("user_1", "jam-player")).toBe(false)
  })

  it("grants only the products in an active plan's entitlements", async () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abc")
    vi.stubEnv("DATABASE_URL", "postgres://x")
    requireDb.mockReturnValue(
      fakeDb([subscriptionRow({ status: "active", plan: "jam_player" })]),
    )
    expect(await userHasProduct("user_1", "jam-player")).toBe(true)
    expect(await userHasProduct("user_1", "style-maker")).toBe(false)
  })

  it("treats trialing the same as active", async () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abc")
    vi.stubEnv("DATABASE_URL", "postgres://x")
    requireDb.mockReturnValue(
      fakeDb([subscriptionRow({ status: "trialing", plan: "style_maker" })]),
    )
    expect(await userHasProduct("user_1", "style-maker")).toBe(true)
  })

  it("all_access unlocks both products", async () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abc")
    vi.stubEnv("DATABASE_URL", "postgres://x")
    requireDb.mockReturnValue(
      fakeDb([subscriptionRow({ status: "active", plan: "all_access" })]),
    )
    expect(await userHasProduct("user_1", "style-maker")).toBe(true)
    expect(await userHasProduct("user_1", "jam-player")).toBe(true)
  })

  it("never reaches the DB when Stripe/DB are unconfigured outside development (fails closed)", async () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("STRIPE_SECRET_KEY", "")
    vi.stubEnv("DATABASE_URL", "")
    expect(await userHasProduct("user_1", "style-maker")).toBe(false)
    expect(requireDb).not.toHaveBeenCalled()
  })

  it("dev bypass grants every product, and only in development with billing unconfigured", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("STRIPE_SECRET_KEY", "")
    vi.stubEnv("DATABASE_URL", "")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(await userHasProduct("user_1", "style-maker")).toBe(true)
    expect(await userHasProduct("user_1", "jam-player")).toBe(true)
    expect(requireDb).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe("getJamPlayerEntitlement", () => {
  it("is hasFullAccess:false for anonymous users (free tier stays open elsewhere)", async () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "")
    vi.stubEnv("CLERK_SECRET_KEY", "")
    vi.stubEnv("STRIPE_SECRET_KEY", "")
    vi.stubEnv("DATABASE_URL", "")
    const result = await getJamPlayerEntitlement()
    expect(result).toEqual({ hasFullAccess: false })
  })
})
