import { beforeEach, describe, expect, it, vi } from "vitest"

const getSessionUserIdMock = vi.fn()
const prepareMock = vi.fn()
const reharmonizeMock = vi.fn()

vi.mock("@/lib/auth", () => ({
  getSessionUserId: () => getSessionUserIdMock(),
}))

vi.mock("@/lib/engine-proxy/runtime", () => ({
  getJamEngineService: () => ({
    prepare: (...args: unknown[]) => prepareMock(...args),
    reharmonize: (...args: unknown[]) => reharmonizeMock(...args),
  }),
}))

describe("jam engine API routes", () => {
  beforeEach(() => {
    getSessionUserIdMock.mockReset()
    prepareMock.mockReset()
    reharmonizeMock.mockReset()
  })

  it("rejects unauthenticated prepare calls", async () => {
    getSessionUserIdMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/engine/jam/prepare/route")
    const response = await POST(
      new Request("http://localhost/api/engine/jam/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: "proj_1", model: "genos2", song: {} }),
      }),
    )
    expect(response.status).toBe(401)
    expect(prepareMock).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated reharmonize calls", async () => {
    getSessionUserIdMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/engine/jam/reharmonize/route")
    const response = await POST(
      new Request("http://localhost/api/engine/jam/reharmonize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: "proj_1", model: "genos2", scope: "song", key: "C", chords: [] }),
      }),
    )
    expect(response.status).toBe(401)
    expect(reharmonizeMock).not.toHaveBeenCalled()
  })

  it("returns abuse-safe validation errors without calling the engine", async () => {
    getSessionUserIdMock.mockResolvedValue("user-1")
    const { POST } = await import("@/app/api/engine/jam/prepare/route")
    const response = await POST(
      new Request("http://localhost/api/engine/jam/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: "proj_1", model: "motif" }),
      }),
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe("validation")
    expect(prepareMock).not.toHaveBeenCalled()
  })
})
