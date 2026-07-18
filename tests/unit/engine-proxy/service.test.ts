import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  JamEngineService,
  MemoryEngineUsageStore,
  PrivateEngineClient,
} from "@/lib/engine-proxy"
import { JamError } from "@/lib/jam/domain"
import type { JamPrepareRequest, JamReharmonizeRequest } from "@/lib/jam/domain"

const contractsDir = path.join(process.cwd(), "contracts", "v1")

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(contractsDir, name), "utf8")) as T
}

function createService(options?: {
  prepareImpl?: () => Promise<unknown>
  reharmonizeImpl?: () => Promise<unknown>
  dailyLimit?: number
  perMinuteLimit?: number
  entitled?: boolean
  ownerOk?: boolean
}) {
  const usage = new MemoryEngineUsageStore()
  const prepareResponse = fixture("jam-prepare.response.json")
  const reharmonizeResponse = fixture("jam-reharmonize.response.json")
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith("/v1/jam/prepare")) {
      if (options?.prepareImpl) {
        const body = await options.prepareImpl()
        return new Response(JSON.stringify(body), { status: 200 })
      }
      return new Response(JSON.stringify(prepareResponse), { status: 200 })
    }
    if (url.endsWith("/v1/jam/reharmonize")) {
      if (options?.reharmonizeImpl) {
        const body = await options.reharmonizeImpl()
        return new Response(JSON.stringify(body), { status: 200 })
      }
      return new Response(JSON.stringify(reharmonizeResponse), { status: 200 })
    }
    return new Response("not found", { status: 404 })
  })

  const config = {
    baseUrl: new URL("https://engine.example.internal"),
    signingSecret: "secret",
    dailyLimit: options?.dailyLimit ?? 5,
    perMinuteLimit: options?.perMinuteLimit ?? 3,
    maxSkewSeconds: 60,
  }

  let id = 0
  const service = new JamEngineService({
    usageStore: usage,
    config,
    engineClient: new PrivateEngineClient({
      config,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }),
    requireEntitlement: async () => {
      if (options?.entitled === false) {
        throw new JamError("forbidden", "Service entitlement required: jam-player")
      }
    },
    requireOwner: async () => {
      if (options?.ownerOk === false) {
        throw new JamError("forbidden", "You do not own this project.")
      }
    },
    createId: () => `evt-${++id}`,
    now: () => new Date("2026-07-18T12:00:00.000Z"),
  })

  return { service, usage, fetchImpl }
}

describe("JamEngineService quotas and authorization", () => {
  const prepareRequest: JamPrepareRequest = {
    projectId: "proj_1",
    ...fixture<Omit<JamPrepareRequest, "projectId">>("jam-prepare.request.json"),
  }

  const reharmonizeRequest: JamReharmonizeRequest = {
    projectId: "proj_1",
    ...fixture<Omit<JamReharmonizeRequest, "projectId">>("jam-reharmonize.request.json"),
  }

  it("requires jam-player entitlement and project ownership", async () => {
    const deniedEntitlement = createService({ entitled: false })
    await expect(
      deniedEntitlement.service.prepare("user-1", prepareRequest),
    ).rejects.toMatchObject({ code: "forbidden" })
    expect(deniedEntitlement.fetchImpl).not.toHaveBeenCalled()

    const deniedOwner = createService({ ownerOk: false })
    await expect(
      deniedOwner.service.prepare("user-1", prepareRequest),
    ).rejects.toMatchObject({ code: "forbidden" })
    expect(deniedOwner.fetchImpl).not.toHaveBeenCalled()
  })

  it("records completed usage and does not consume daily quota on backend failure", async () => {
    const failing = createService()
    failing.fetchImpl.mockRejectedValueOnce(new Error("network down"))
    await expect(failing.service.prepare("user-1", prepareRequest)).rejects.toMatchObject({
      code: "unavailable",
    })
    expect(failing.usage.events).toHaveLength(1)
    expect(failing.usage.events[0]).toMatchObject({
      status: "failed",
      operation: "jam_prepare",
    })
    expect(await failing.usage.countCompletedSince("user-1", new Date(0))).toBe(0)

    const ok = createService()
    await ok.service.prepare("user-1", prepareRequest)
    expect(await ok.usage.countCompletedSince("user-1", new Date(0))).toBe(1)
    expect(ok.usage.events[0]?.status).toBe("completed")
  })

  it("enforces per-minute and daily quotas without leaking backend details", async () => {
    const { service, usage, fetchImpl } = createService({
      dailyLimit: 2,
      perMinuteLimit: 2,
    })

    await service.prepare("user-1", prepareRequest)
    await service.reharmonize("user-1", reharmonizeRequest)
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    await expect(service.prepare("user-1", prepareRequest)).rejects.toMatchObject({
      code: "quota_exceeded",
    })
    expect(usage.events.some((event) => event.status === "rejected")).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("never exposes private engine URL or signing secret in errors", async () => {
    const { service, fetchImpl } = createService()
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "secret stack" } }), { status: 500 }),
    )
    await expect(service.prepare("user-1", prepareRequest)).rejects.toMatchObject({
      code: "unavailable",
      message: expect.not.stringMatching(/engine\.example|secret|stack/i),
    })
  })
})
