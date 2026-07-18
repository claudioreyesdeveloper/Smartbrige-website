import { JamError } from "@/lib/jam/domain/errors"
import type { EngineProxyConfig } from "@/lib/engine-proxy/env"
import type { EngineUsageStore } from "@/lib/engine-proxy/usage"

export type QuotaCheckResult = {
  dailyUsed: number
  perMinuteUsed: number
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/**
 * Enforce per-user daily (completed) and per-minute (attempts) quotas.
 * Failed backend calls must not increment completed daily usage.
 */
export async function assertWithinQuota(options: {
  userId: string
  store: EngineUsageStore
  config: EngineProxyConfig
  now: Date
}): Promise<QuotaCheckResult> {
  const dayStart = startOfUtcDay(options.now)
  const minuteStart = new Date(options.now.getTime() - 60_000)

  const [dailyUsed, perMinuteUsed] = await Promise.all([
    options.store.countCompletedSince(options.userId, dayStart),
    options.store.countAttemptsSince(options.userId, minuteStart),
  ])

  if (dailyUsed >= options.config.dailyLimit) {
    throw new JamError("quota_exceeded", "Daily jam engine quota exceeded.")
  }
  if (perMinuteUsed >= options.config.perMinuteLimit) {
    throw new JamError("quota_exceeded", "Jam engine rate limit exceeded.")
  }

  return { dailyUsed, perMinuteUsed }
}
