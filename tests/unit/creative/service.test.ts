import { describe, expect, it, vi } from "vitest"
import { createMemoryCreativeService } from "@/lib/creative/service"
import {
  ENGINE_REQUEST_MAX_ATTEMPTS,
  PrivateEngineClient,
} from "@/lib/engine-proxy/client"
import type { EngineProxyConfig } from "@/lib/engine-proxy/env"
import { sha256Hex } from "@/lib/engine-proxy/hmac"
import type { ProjectDetail } from "@/lib/projects/service"

const config: EngineProxyConfig = {
  baseUrl: new URL("https://private.example"),
  signingSecret: "test-secret",
  dailyLimit: 200,
  perMinuteLimit: 20,
  maxSkewSeconds: 60,
}

const project: ProjectDetail = {
  id: "project_1",
  title: "Song",
  revisionId: "revision_1",
  version: 1,
  createdAt: "2026-07-18T00:00:00.000Z",
  updatedAt: "2026-07-18T00:00:00.000Z",
  document: {
    schemaVersion: 1,
    song: {
      title: "Song",
      tempo: 120,
      key: "C",
      sections: [{
        id: "section_1",
        name: "Verse",
        bars: 4,
        chords: [
          { symbol: "C", startBeat: 0, durationBeats: 8 },
          { symbol: "F", startBeat: 8, durationBeats: 8 },
        ],
      }],
    },
  },
}

function responseFor(url: string): unknown {
  if (url.endsWith("/solo/options")) {
    return {
      expiresAt: "2026-07-18T12:15:00.000Z",
      instruments: [{ optionId: "option_1", label: "Sax" }],
      styles: [{ optionId: "option_2", label: "Jazz" }],
    }
  }
  if (url.endsWith("/solo/generate")) {
    return {
      generationId: "generation_1",
      expiresAt: "2026-07-18T12:15:00.000Z",
      takes: [
        { takeId: "take_1", label: "Take 1", durationMs: 8000 },
        { takeId: "take_2", label: "Take 2", durationMs: 8000 },
      ],
    }
  }
  return {
    generationId: "generation_lyrics_1",
    lines: [{ phraseId: "phrase_1", text: "we go home" }],
  }
}

describe("creative service authorization and private dispatch", () => {
  it("uses a bounded timeout and never retries non-idempotent POST operations", async () => {
    let signal: AbortSignal | null | undefined
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      signal = init?.signal
      throw new DOMException("timed out", "TimeoutError")
    })
    const client = new PrivateEngineClient({ config, fetchImpl })
    await expect(client.soloOptions({
      subjectId: "user_1",
      projectId: "project_1",
    })).rejects.toMatchObject({ code: "unavailable" })
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(ENGINE_REQUEST_MAX_ATTEMPTS).toBe(1)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("enforces service-specific entitlements and sends server identity with HMAC", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown>; headers: Headers }> = []
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = String(init?.body)
      calls.push({
        url: String(input),
        body: JSON.parse(body) as Record<string, unknown>,
        headers: new Headers(init?.headers),
      })
      return Response.json(responseFor(String(input)))
    })
    const requireSoloEntitlement = vi.fn(async (_userId: string) => undefined)
    const requireLyricsEntitlement = vi.fn(async (_userId: string) => "grant_lyrics_1")
    const { service } = createMemoryCreativeService({
      config,
      engineClient: new PrivateEngineClient({ config, fetchImpl, nowMs: () => 1_700_000_000_000 }),
      requireSoloEntitlement,
      requireLyricsEntitlement,
      loadProject: async () => project,
    })

    await service.soloOptions("user_1", { projectId: "project_1" })
    await service.soloGenerate("user_1", {
      projectId: "project_1",
      sectionId: "section_1",
      contextRevision: "revision_1",
      model: "genos2",
      optionsExpiresAt: "2026-07-18T12:15:00.000Z",
      instrumentOptionId: "option_1",
      styleOptionId: "option_2",
      takeCount: 2,
    })
    await service.lyricGenerate("user_1", {
      projectId: "project_1",
      creative: { theme: "home", language: "en" },
      prosody: {
        phrases: [{
          phraseId: "phrase_1",
          sectionRole: "verse",
          syllables: 3,
          prominence: [],
          sustain: [],
        }],
      },
    })

    expect(requireSoloEntitlement).toHaveBeenCalledTimes(2)
    expect(requireLyricsEntitlement).toHaveBeenCalledOnce()
    expect(calls[1]?.body).toMatchObject({
      subjectId: "user_1",
      projectId: "project_1",
      context: {
        sectionId: "section_1",
        bars: 4,
        bpm: 120,
        key: "C",
      },
    })
    expect(calls[2]?.body).toEqual({
      subjectId: "user_1",
      projectId: "project_1",
      entitlement: { product: "lyrics", grantId: "grant_lyrics_1" },
      creative: { theme: "home", language: "en" },
      prosody: {
        phrases: [{
          phraseId: "phrase_1",
          sectionRole: "verse",
          syllables: 3,
          prominence: [],
          sustain: [],
        }],
      },
    })
    for (const call of calls) {
      expect(call.headers.get("x-sb-request-id")).toMatch(/^req_[A-Za-z0-9_-]{32}$/)
      expect(call.headers.get("x-sb-content-sha256")).toBe(
        sha256Hex(JSON.stringify(call.body)),
      )
      expect(call.headers.get("x-sb-signature")).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it("stops before private dispatch when an entitlement or revision fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const denied = createMemoryCreativeService({
      config,
      engineClient: new PrivateEngineClient({ config, fetchImpl }),
      requireSoloEntitlement: async () => {
        throw new Error("denied")
      },
      loadProject: async () => project,
    }).service
    await expect(denied.soloOptions("user_1", { projectId: "project_1" })).rejects.toThrow("denied")
    expect(fetchImpl).not.toHaveBeenCalled()

    const stale = createMemoryCreativeService({
      config,
      engineClient: new PrivateEngineClient({ config, fetchImpl }),
      requireSoloEntitlement: async () => undefined,
      loadProject: async () => project,
    }).service
    await expect(stale.soloGenerate("user_1", {
      projectId: "project_1",
      sectionId: "section_1",
      contextRevision: "revision_stale",
      model: "genos2",
      optionsExpiresAt: "2026-07-18T12:15:00.000Z",
      instrumentOptionId: "option_1",
      styleOptionId: "option_2",
      takeCount: 2,
    })).rejects.toMatchObject({ code: "validation" })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
