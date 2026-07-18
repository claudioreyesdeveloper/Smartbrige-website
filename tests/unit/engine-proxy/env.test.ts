import { describe, expect, it } from "vitest"
import {
  ENGINE_PROXY_ENV_VAR_NAMES,
  PRIVATE_ENGINE_SIGNING_SECRET_ENV,
  PRIVATE_ENGINE_URL_ENV,
  listEngineProxyEnvVarNames,
  readEngineProxyConfig,
} from "@/lib/engine-proxy"

describe("engine proxy env", () => {
  it("documents required private engine env names without exposing values", () => {
    expect(listEngineProxyEnvVarNames()).toEqual([...ENGINE_PROXY_ENV_VAR_NAMES])
    expect(PRIVATE_ENGINE_URL_ENV).toBe("PRIVATE_ENGINE_URL")
    expect(PRIVATE_ENGINE_SIGNING_SECRET_ENV).toBe("PRIVATE_ENGINE_SIGNING_SECRET")
  })

  it("loads signing config from env", () => {
    const config = readEngineProxyConfig({
      PRIVATE_ENGINE_URL: "https://engine.example.internal/api",
      PRIVATE_ENGINE_SIGNING_SECRET: "super-secret",
      ENGINE_QUOTA_DAILY_LIMIT: "50",
      ENGINE_QUOTA_PER_MINUTE_LIMIT: "5",
    })
    expect(config.baseUrl.toString()).toBe("https://engine.example.internal/api")
    expect(config.signingSecret).toBe("super-secret")
    expect(config.dailyLimit).toBe(50)
    expect(config.perMinuteLimit).toBe(5)
  })
})
