import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.fn()
const startServiceCheckoutMock = vi.fn()
const startBillingPortalMock = vi.fn()

vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}))

vi.mock("@/lib/billing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing")>("@/lib/billing")
  return {
    ...actual,
    startServiceCheckout: (...args: unknown[]) => startServiceCheckoutMock(...args),
    startBillingPortal: (...args: unknown[]) => startBillingPortalMock(...args),
  }
})

describe("billing API routes authorization", () => {
  beforeEach(() => {
    authMock.mockReset()
    startServiceCheckoutMock.mockReset()
    startBillingPortalMock.mockReset()
  })

  it("rejects unauthorized checkout calls", async () => {
    authMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/billing/checkout/route")
    const response = await POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceKey: "jam-player" }),
      }),
    )
    expect(response.status).toBe(401)
    expect(startServiceCheckoutMock).not.toHaveBeenCalled()
  })

  it("rejects unauthorized portal calls", async () => {
    authMock.mockResolvedValue({ user: { id: undefined, email: undefined } })
    const { POST } = await import("@/app/api/billing/portal/route")
    const response = await POST()
    expect(response.status).toBe(401)
    expect(startBillingPortalMock).not.toHaveBeenCalled()
  })

  it("starts checkout for an authenticated user without trusting client entitlements", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", email: "a@example.com" } })
    startServiceCheckoutMock.mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.test/session",
      sessionId: "cs_test",
    })
    const { POST } = await import("@/app/api/billing/checkout/route")
    const response = await POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceKey: "jam-player",
          entitled: true,
          entitlementStatus: "active",
        }),
      }),
    )
    expect(response.status).toBe(200)
    expect(startServiceCheckoutMock).toHaveBeenCalledWith({
      userId: "user-1",
      email: "a@example.com",
      serviceKey: "jam-player",
    })
  })
})
