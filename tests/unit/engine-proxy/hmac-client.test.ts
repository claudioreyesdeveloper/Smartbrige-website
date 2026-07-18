import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  HMAC_BODY_HASH_HEADER,
  HMAC_SIGNATURE_HEADER,
  HMAC_TIMESTAMP_HEADER,
  PrivateEngineClient,
  buildSigningPayload,
  resolvePrivateEngineBaseUrl,
  sha256Hex,
  signPayload,
} from "@/lib/engine-proxy"
import { JamError } from "@/lib/jam/domain"

const contractsDir = path.join(process.cwd(), "contracts", "v1")
const SECRET = "test-signing-secret-aaaaaaaa"

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(contractsDir, name), "utf8")) as T
}

describe("engine proxy HMAC and SSRF guards", () => {
  it("signs requests with timestamp and body hash compatible with the private verifier", async () => {
    const prepareRequest = fixture<Record<string, unknown>>("jam-prepare.request.json")
    const prepareResponse = fixture("jam-prepare.response.json")
    let seenUrl = ""
    let seenHeaders: Headers | undefined
    let seenBody = ""

    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seenUrl = String(input)
      seenHeaders = new Headers(init?.headers)
      seenBody = String(init?.body ?? "")
      return new Response(JSON.stringify(prepareResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const client = new PrivateEngineClient({
      config: {
        baseUrl: new URL("https://engine.example.internal"),
        signingSecret: SECRET,
        dailyLimit: 100,
        perMinuteLimit: 10,
        maxSkewSeconds: 60,
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      nowMs: () => 1_700_000_000_000,
    })

    const result = await client.prepare(prepareRequest as never)
    expect(result.planId).toBe("pln_fixture_0001")
    expect(seenUrl).toBe("https://engine.example.internal/v1/jam/prepare")
    expect(seenHeaders?.get(HMAC_TIMESTAMP_HEADER)).toBe("1700000000")
    expect(seenHeaders?.get(HMAC_BODY_HASH_HEADER)).toBe(sha256Hex(seenBody))
    expect(seenHeaders?.get(HMAC_SIGNATURE_HEADER)).toBe(
      signPayload(SECRET, buildSigningPayload("1700000000", sha256Hex(seenBody))),
    )
  })

  it("rejects non-loopback http private engine URLs", () => {
    expect(() =>
      resolvePrivateEngineBaseUrl({
        PRIVATE_ENGINE_URL: "http://evil.example/engine",
      }),
    ).toThrow(JamError)

    expect(
      resolvePrivateEngineBaseUrl({
        PRIVATE_ENGINE_URL: "http://127.0.0.1:8787",
      }).toString(),
    ).toBe("http://127.0.0.1:8787/")
  })

  it("does not follow redirects (open-proxy / SSRF hardening)", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://attacker.example/steal" },
      })
    })
    const client = new PrivateEngineClient({
      config: {
        baseUrl: new URL("https://engine.example.internal"),
        signingSecret: SECRET,
        dailyLimit: 100,
        perMinuteLimit: 10,
        maxSkewSeconds: 60,
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(
      client.prepare(fixture("jam-prepare.request.json") as never),
    ).rejects.toMatchObject({ code: "unavailable" })
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ redirect: "manual" }),
    )
  })

  it("strips forbidden backend fields before returning", async () => {
    const clean = fixture<Record<string, unknown>>("jam-prepare.response.json")
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ...clean,
          seed: 123,
          recipe: { x: 1 },
          rankingScore: 0.5,
        }),
        { status: 200 },
      )
    })
    const client = new PrivateEngineClient({
      config: {
        baseUrl: new URL("https://engine.example.internal"),
        signingSecret: SECRET,
        dailyLimit: 100,
        perMinuteLimit: 10,
        maxSkewSeconds: 60,
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const result = await client.prepare(fixture("jam-prepare.request.json") as never)
    expect(result).not.toHaveProperty("seed")
    expect(result).not.toHaveProperty("recipe")
    expect(result.planId).toBe("pln_fixture_0001")
  })
})
