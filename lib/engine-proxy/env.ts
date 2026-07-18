import { JamError } from "@/lib/jam/domain/errors"
import { DEFAULT_HMAC_MAX_SKEW_SECONDS } from "@/lib/jam/domain/limits"

/** Public proxy → private algorithm-service configuration (names only). */
export const PRIVATE_ENGINE_URL_ENV = "PRIVATE_ENGINE_URL"
export const PRIVATE_ENGINE_SIGNING_SECRET_ENV = "PRIVATE_ENGINE_SIGNING_SECRET"
export const ENGINE_QUOTA_DAILY_LIMIT_ENV = "ENGINE_QUOTA_DAILY_LIMIT"
export const ENGINE_QUOTA_PER_MINUTE_LIMIT_ENV = "ENGINE_QUOTA_PER_MINUTE_LIMIT"
export const ENGINE_HMAC_MAX_SKEW_SECONDS_ENV = "ENGINE_HMAC_MAX_SKEW_SECONDS"

export const ENGINE_PROXY_ENV_VAR_NAMES = [
  PRIVATE_ENGINE_URL_ENV,
  PRIVATE_ENGINE_SIGNING_SECRET_ENV,
  ENGINE_QUOTA_DAILY_LIMIT_ENV,
  ENGINE_QUOTA_PER_MINUTE_LIMIT_ENV,
  ENGINE_HMAC_MAX_SKEW_SECONDS_ENV,
] as const

export const DEFAULT_DAILY_QUOTA = 200
export const DEFAULT_PER_MINUTE_QUOTA = 20

export type EngineProxyConfig = {
  baseUrl: URL
  signingSecret: string
  dailyLimit: number
  perMinuteLimit: number
  maxSkewSeconds: number
}

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  if (!raw?.trim()) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > max) return fallback
  return parsed
}

/**
 * Resolve and validate the private engine base URL.
 * Rejects user-controlled hosts; only the configured absolute URL is used (SSRF-safe).
 */
export function resolvePrivateEngineBaseUrl(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): URL {
  const raw = env[PRIVATE_ENGINE_URL_ENV]?.trim()
  if (!raw) {
    throw new JamError("misconfigured", "Private engine is not configured.")
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new JamError("misconfigured", "Private engine is not configured.")
  }
  if (url.username || url.password) {
    throw new JamError("misconfigured", "Private engine is not configured.")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new JamError("misconfigured", "Private engine is not configured.")
  }
  const host = url.hostname.toLowerCase()
  const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "[::1]"
  if (url.protocol === "http:" && !isLoopback) {
    throw new JamError("misconfigured", "Private engine is not configured.")
  }
  // Normalize: no hash/query on base; trailing slash stripped for join safety.
  url.hash = ""
  url.search = ""
  if (url.pathname.endsWith("/") && url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "")
  }
  return url
}

export function readEngineProxyConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): EngineProxyConfig {
  const signingSecret = env[PRIVATE_ENGINE_SIGNING_SECRET_ENV]?.trim()
  if (!signingSecret) {
    throw new JamError("misconfigured", "Private engine is not configured.")
  }
  return {
    baseUrl: resolvePrivateEngineBaseUrl(env),
    signingSecret,
    dailyLimit: parsePositiveInt(env[ENGINE_QUOTA_DAILY_LIMIT_ENV], DEFAULT_DAILY_QUOTA, 100_000),
    perMinuteLimit: parsePositiveInt(
      env[ENGINE_QUOTA_PER_MINUTE_LIMIT_ENV],
      DEFAULT_PER_MINUTE_QUOTA,
      10_000,
    ),
    maxSkewSeconds: parsePositiveInt(
      env[ENGINE_HMAC_MAX_SKEW_SECONDS_ENV],
      DEFAULT_HMAC_MAX_SKEW_SECONDS,
      600,
    ),
  }
}

export function listEngineProxyEnvVarNames(): readonly string[] {
  return ENGINE_PROXY_ENV_VAR_NAMES
}
