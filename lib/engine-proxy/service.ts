import { requireServiceEntitlement } from "@/lib/auth/entitlements"
import { AuthorizationError } from "@/lib/auth/owner"
import { PrivateEngineClient } from "@/lib/engine-proxy/client"
import { readEngineProxyConfig, type EngineProxyConfig } from "@/lib/engine-proxy/env"
import { assertWithinQuota } from "@/lib/engine-proxy/quota"
import {
  MemoryEngineUsageStore,
  NeonEngineUsageStore,
  type EngineUsageStore,
} from "@/lib/engine-proxy/usage"
import { JamError } from "@/lib/jam/domain/errors"
import type {
  JamPrepareRequest,
  JamPrepareResponse,
  JamReharmonizeRequest,
  JamReharmonizeResponse,
} from "@/lib/jam/domain/types"
import {
  toEnginePrepareRequest,
  toEngineReharmonizeRequest,
} from "@/lib/jam/domain/validate"

export type JamEngineServiceDependencies = {
  usageStore?: EngineUsageStore
  engineClient?: PrivateEngineClient
  config?: EngineProxyConfig
  requireEntitlement?: (userId: string) => Promise<void>
  /** @deprecated Ignored — jam no longer gates on cloud project ownership. */
  requireOwner?: (userId: string, projectId: string) => Promise<void>
  now?: () => Date
  createId?: () => string
}

export class JamEngineService {
  private readonly usageStore: EngineUsageStore
  private readonly engineClient: PrivateEngineClient
  private readonly config: EngineProxyConfig
  private readonly requireEntitlement: (userId: string) => Promise<void>
  private readonly now: () => Date
  private readonly createId: () => string

  constructor(deps: JamEngineServiceDependencies = {}) {
    this.config = deps.config ?? readEngineProxyConfig()
    this.usageStore = deps.usageStore ?? new NeonEngineUsageStore()
    this.engineClient =
      deps.engineClient ??
      new PrivateEngineClient({
        config: this.config,
      })
    this.requireEntitlement =
      deps.requireEntitlement ??
      ((userId) => requireServiceEntitlement(userId, "jam-player"))
    this.now = deps.now ?? (() => new Date())
    this.createId = deps.createId ?? (() => crypto.randomUUID())
  }

  async prepare(userId: string, request: JamPrepareRequest): Promise<JamPrepareResponse> {
    return this.runAuthorized(userId, request.projectId, "jam_prepare", () =>
      this.engineClient.prepare(toEnginePrepareRequest(request)),
    )
  }

  async reharmonize(
    userId: string,
    request: JamReharmonizeRequest,
  ): Promise<JamReharmonizeResponse> {
    return this.runAuthorized(userId, request.projectId, "jam_reharmonize", () =>
      this.engineClient.reharmonize(
        toEngineReharmonizeRequest(request, userId, request.projectId),
      ),
    )
  }

  private async runAuthorized<T>(
    userId: string,
    projectId: string,
    operation: "jam_prepare" | "jam_reharmonize",
    invoke: () => Promise<T>,
  ): Promise<T> {
    try {
      // Entitlement + quota only. projectId is a client correlation id for audit —
      // not a cloud project (desktop has Save/Load files, not a project list).
      await this.requireEntitlement(userId)
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw new JamError(
          error.code === "unauthenticated"
            ? "unauthenticated"
            : error.code === "not_found"
              ? "not_found"
              : "forbidden",
          error.message,
        )
      }
      throw error
    }

    const startedAt = this.now()
    // Usage audit only — jam no longer requires a cloud project row. Never write
    // a client session id into project_id (FK to projects) or Play returns 500.
    void projectId
    const auditProjectId: string | null = null
    try {
      await assertWithinQuota({
        userId,
        store: this.usageStore,
        config: this.config,
        now: startedAt,
      })
    } catch (error) {
      if (error instanceof JamError && error.code === "quota_exceeded") {
        await this.usageStore.record({
          id: this.createId(),
          userId,
          projectId: auditProjectId,
          operation,
          status: "rejected",
          errorCode: "quota_exceeded",
          durationMs: 0,
          createdAt: this.now(),
        })
      }
      throw error
    }

    try {
      const result = await invoke()
      const finishedAt = this.now()
      await this.usageStore.record({
        id: this.createId(),
        userId,
        projectId: auditProjectId,
        operation,
        status: "completed",
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
        createdAt: finishedAt,
      })
      return result
    } catch (error) {
      const finishedAt = this.now()
      const errorCode =
        error instanceof JamError
          ? error.code
          : error instanceof AuthorizationError
            ? error.code
            : "unavailable"
      // Failed backend calls are audited but do not consume completed daily quota.
      try {
        await this.usageStore.record({
          id: this.createId(),
          userId,
          projectId: auditProjectId,
          operation,
          status: "failed",
          errorCode,
          durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
          createdAt: finishedAt,
        })
      } catch {
        // Never mask the original engine/auth failure with an audit insert error.
      }
      throw error
    }
  }
}

export function createMemoryJamEngineService(
  overrides: JamEngineServiceDependencies = {},
): { service: JamEngineService; usage: MemoryEngineUsageStore } {
  const usage = new MemoryEngineUsageStore()
  const service = new JamEngineService({
    usageStore: usage,
    ...overrides,
  })
  return { service, usage }
}
