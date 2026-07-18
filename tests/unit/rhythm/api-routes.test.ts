import { beforeEach, describe, expect, it, vi } from "vitest"

const getSessionUserId = vi.fn()
const options = vi.fn()
const query = vi.fn()
const fills = vi.fn()
const render = vi.fn()

vi.mock("@/lib/auth", () => ({
  getSessionUserId: () => getSessionUserId(),
}))

vi.mock("@/lib/rhythm/runtime", () => ({
  getRhythmService: () => ({ options, query, fills, render }),
}))

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("rhythm proxy routes", () => {
  beforeEach(() => {
    getSessionUserId.mockReset()
    options.mockReset()
    query.mockReset()
    fills.mockReset()
    render.mockReset()
  })

  it("rejects unauthenticated calls before parsing or dispatch", async () => {
    getSessionUserId.mockResolvedValue(null)
    const { POST } = await import("@/app/api/engine/rhythm/query/route")
    const response = await POST(request("/api/engine/rhythm/query", {}))
    expect(response.status).toBe(401)
    expect(query).not.toHaveBeenCalled()
  })

  it("strictly rejects client identity, context, and recipe fields", async () => {
    getSessionUserId.mockResolvedValue("user_1")
    const { POST } = await import("@/app/api/engine/rhythm/render/route")
    const response = await POST(
      request("/api/engine/rhythm/render", {
        projectId: "proj_1",
        sectionId: "sec_1",
        contextRevision: "rev_1",
        model: "genos2",
        operation: "audition",
        part: "bass",
        candidateId: "rhy_1",
        subjectId: "attacker",
        context: { bpm: 1 },
        recipe: { seed: 1 },
      }),
    )
    expect(response.status).toBe(400)
    expect(render).not.toHaveBeenCalled()
  })

  it("delegates all capped public shapes with the authenticated subject", async () => {
    getSessionUserId.mockResolvedValue("user_1")
    options.mockResolvedValue({ genres: [], sectionTypes: [], feels: [] })
    query.mockResolvedValue({
      queryId: "qry_1",
      expiresAt: "2026-07-18T12:15:00.000Z",
      candidates: [],
    })
    fills.mockResolvedValue({
      queryId: "fqy_1",
      expiresAt: "2026-07-18T12:15:00.000Z",
      fills: [],
    })
    render.mockResolvedValue({ renders: [] })

    const routes = await Promise.all([
      import("@/app/api/engine/rhythm/options/route"),
      import("@/app/api/engine/rhythm/query/route"),
      import("@/app/api/engine/rhythm/fills/route"),
      import("@/app/api/engine/rhythm/render/route"),
    ])
    await routes[0].POST(request("/options", { projectId: "proj_1", kind: "bass" }))
    await routes[1].POST(
      request("/query", {
        projectId: "proj_1",
        sectionId: "sec_1",
        contextRevision: "rev_1",
        kind: "drums",
        mode: "browse",
        filters: {},
        limit: 999,
      }),
    )
    await routes[2].POST(
      request("/fills", {
        projectId: "proj_1",
        sectionId: "sec_1",
        contextRevision: "rev_1",
        drumCandidateId: "rhy_1",
      }),
    )
    await routes[3].POST(
      request("/render", {
        projectId: "proj_1",
        sectionId: "sec_1",
        contextRevision: "rev_1",
        model: "genos2",
        operation: "apply",
        bassCandidateId: "rhy_bass",
      }),
    )

    expect(options).toHaveBeenCalledWith("user_1", { projectId: "proj_1", kind: "bass" })
    expect(query).not.toHaveBeenCalled()
    expect(fills).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({ limit: 12, drumCandidateId: "rhy_1" }),
    )
    expect(render).toHaveBeenCalledWith(
      "user_1",
      expect.not.objectContaining({ subjectId: expect.anything(), context: expect.anything() }),
    )
  })
})
