import { and, count, eq, gte, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { engineUsageEvents } from "@/lib/db/schema"
import type { EngineOperation } from "@/lib/jam/domain/types"

export type EngineUsageStatus = "completed" | "failed" | "rejected"

export type EngineUsageEvent = {
  id: string
  userId: string
  projectId: string | null
  operation: EngineOperation
  status: EngineUsageStatus
  errorCode: string | null
  durationMs: number | null
  createdAt: Date
}

export type RecordUsageInput = {
  id: string
  userId: string
  projectId?: string | null
  operation: EngineOperation
  status: EngineUsageStatus
  errorCode?: string | null
  durationMs?: number | null
  createdAt: Date
}

export interface EngineUsageStore {
  record(event: RecordUsageInput): Promise<void>
  countCompletedSince(userId: string, since: Date): Promise<number>
  countAttemptsSince(userId: string, since: Date): Promise<number>
}

/** Durable Neon-backed usage/audit store — never stores raw musical content. */
export class NeonEngineUsageStore implements EngineUsageStore {
  async record(event: RecordUsageInput): Promise<void> {
    const db = getDb()
    await db.insert(engineUsageEvents).values({
      id: event.id,
      userId: event.userId,
      projectId: event.projectId ?? null,
      operation: event.operation,
      status: event.status,
      errorCode: event.errorCode ?? null,
      durationMs: event.durationMs ?? null,
      createdAt: event.createdAt,
    })
  }

  async countCompletedSince(userId: string, since: Date): Promise<number> {
    const db = getDb()
    const rows = await db
      .select({ value: count() })
      .from(engineUsageEvents)
      .where(
        and(
          eq(engineUsageEvents.userId, userId),
          eq(engineUsageEvents.status, "completed"),
          gte(engineUsageEvents.createdAt, since),
        ),
      )
    return Number(rows[0]?.value ?? 0)
  }

  async countAttemptsSince(userId: string, since: Date): Promise<number> {
    const db = getDb()
    const rows = await db
      .select({ value: count() })
      .from(engineUsageEvents)
      .where(
        and(
          eq(engineUsageEvents.userId, userId),
          inArray(engineUsageEvents.status, ["completed", "failed"]),
          gte(engineUsageEvents.createdAt, since),
        ),
      )
    return Number(rows[0]?.value ?? 0)
  }
}

/** In-memory usage store for unit tests. */
export class MemoryEngineUsageStore implements EngineUsageStore {
  readonly events: EngineUsageEvent[] = []

  async record(event: RecordUsageInput): Promise<void> {
    this.events.push({
      id: event.id,
      userId: event.userId,
      projectId: event.projectId ?? null,
      operation: event.operation,
      status: event.status,
      errorCode: event.errorCode ?? null,
      durationMs: event.durationMs ?? null,
      createdAt: event.createdAt,
    })
  }

  async countCompletedSince(userId: string, since: Date): Promise<number> {
    return this.events.filter(
      (event) =>
        event.userId === userId &&
        event.status === "completed" &&
        event.createdAt.getTime() >= since.getTime(),
    ).length
  }

  async countAttemptsSince(userId: string, since: Date): Promise<number> {
    return this.events.filter(
      (event) =>
        event.userId === userId &&
        (event.status === "completed" || event.status === "failed") &&
        event.createdAt.getTime() >= since.getTime(),
    ).length
  }
}
