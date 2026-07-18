import {
  getActiveEntitlementForService,
  requireServiceEntitlement,
} from "@/lib/auth/entitlements"
import { AuthorizationError } from "@/lib/auth/owner"
import {
  lyricFitEngineRequestSchema,
  lyricGenerateEngineRequestSchema,
  parseCreative,
  soloGenerateEngineRequestSchema,
  type LyricFitPublicRequest,
  type LyricFitResponse,
  type LyricGeneratePublicRequest,
  type LyricGenerationResponse,
  type SoloGeneratePublicRequest,
  type SoloGenerateResponse,
  type SoloOptionsPublicRequest,
  type SoloOptionsResponse,
  type SoloRenderPublicRequest,
  type SoloRenderResponse,
} from "@/lib/creative/contracts"
import { PrivateEngineClient } from "@/lib/engine-proxy/client"
import { readEngineProxyConfig, type EngineProxyConfig } from "@/lib/engine-proxy/env"
import { assertWithinQuota } from "@/lib/engine-proxy/quota"
import {
  MemoryEngineUsageStore,
  NeonEngineUsageStore,
  type EngineUsageStore,
} from "@/lib/engine-proxy/usage"
import { JamError } from "@/lib/jam/domain/errors"
import type { EngineOperation } from "@/lib/jam/domain/types"
import type { ProjectSection } from "@/lib/projects/document"
import { ProjectError } from "@/lib/projects/errors"
import { getProjectService } from "@/lib/projects/runtime"
import type { ProjectDetail } from "@/lib/projects/service"

type EntitlementCheck = (userId: string) => Promise<void>
type LyricsEntitlementCheck = (userId: string) => Promise<string>

export type CreativeServiceDependencies = {
  usageStore?: EngineUsageStore
  engineClient?: PrivateEngineClient
  config?: EngineProxyConfig
  requireSoloEntitlement?: EntitlementCheck
  requireLyricsEntitlement?: LyricsEntitlementCheck
  loadProject?: (userId: string, projectId: string) => Promise<ProjectDetail>
  now?: () => Date
  createId?: () => string
}

function mapAccessError(error: unknown): never {
  if (error instanceof AuthorizationError || error instanceof ProjectError) {
    const code =
      error.code === "unauthenticated"
        ? "unauthenticated"
        : error.code === "not_found"
          ? "not_found"
          : error.code === "forbidden"
            ? "forbidden"
            : error.code === "payload_too_large"
              ? "payload_too_large"
              : "validation"
    throw new JamError(code, error.message)
  }
  throw error
}

function sectionContext(project: ProjectDetail, sectionId: string, revision: string) {
  if (project.revisionId !== revision) {
    throw new JamError("validation", "Project context changed. Refresh and try again.")
  }
  const section = project.document.song.sections.find((item) => item.id === sectionId)
  if (!section) throw new JamError("not_found", "Project section was not found.")
  const bars = section.bars
  if (!Number.isInteger(bars) || !bars || bars < 1 || bars > 64) {
    throw new JamError("validation", "Solo generation requires a 1–64 bar section.")
  }
  const sorted = [...section.chords].sort((left, right) => left.startBeat - right.startBeat)
  if (!sorted.length) throw new JamError("validation", "Solo generation requires section chords.")
  const chords = sorted.map((chord, index) => {
    const nextBeat = sorted[index + 1]?.startBeat ?? bars * 4
    return {
      symbol: chord.symbol,
      startBar: chord.startBeat / 4,
      durationBars: (chord.durationBeats ?? nextBeat - chord.startBeat) / 4,
    }
  })
  let cursor = 0
  for (const chord of chords) {
    if (chord.durationBars <= 0 || Math.abs(chord.startBar - cursor) > 1e-6) {
      throw new JamError("validation", "Section chords must exactly cover the section.")
    }
    cursor += chord.durationBars
  }
  if (Math.abs(cursor - bars) > 1e-6) {
    throw new JamError("validation", "Section chords must exactly cover the section.")
  }
  return {
    sectionId: section.id,
    sectionName: section.name,
    bars,
    bpm: project.document.song.tempo,
    key: project.document.song.key,
    timeSignature: { numerator: 4 as const, denominator: 4 as const },
    chords,
  }
}

function assertDisplayContextMatchesProject(
  project: ProjectDetail,
  request: LyricFitPublicRequest,
): void {
  if (project.revisionId !== request.contextRevision) {
    throw new JamError("validation", "Project context changed. Refresh and try again.")
  }
  if (
    project.document.song.tempo !== request.tempoBpm ||
    project.document.song.key !== request.key
  ) {
    throw new JamError("validation", "Lyrics context does not match the project.")
  }
}

export class CreativeService {
  private readonly usageStore: EngineUsageStore
  private readonly engineClient: PrivateEngineClient
  private readonly config: EngineProxyConfig
  private readonly requireSoloEntitlement: EntitlementCheck
  private readonly requireLyricsEntitlement: LyricsEntitlementCheck
  private readonly loadProject: (userId: string, projectId: string) => Promise<ProjectDetail>
  private readonly now: () => Date
  private readonly createId: () => string

  constructor(deps: CreativeServiceDependencies = {}) {
    this.config = deps.config ?? readEngineProxyConfig()
    this.usageStore = deps.usageStore ?? new NeonEngineUsageStore()
    this.engineClient = deps.engineClient ?? new PrivateEngineClient({ config: this.config })
    this.requireSoloEntitlement =
      deps.requireSoloEntitlement ??
      ((userId) => requireServiceEntitlement(userId, "solo-phrases"))
    this.requireLyricsEntitlement =
      deps.requireLyricsEntitlement ??
      (async (userId) => {
        const entitlement = await getActiveEntitlementForService(userId, "lyrics")
        if (!entitlement?.grantId) {
          throw new AuthorizationError("forbidden", "Service entitlement required: lyrics")
        }
        return entitlement.grantId
      })
    this.loadProject =
      deps.loadProject ??
      ((userId, projectId) => getProjectService().load(userId, projectId))
    this.now = deps.now ?? (() => new Date())
    this.createId = deps.createId ?? (() => crypto.randomUUID())
  }

  soloOptions(userId: string, request: SoloOptionsPublicRequest): Promise<SoloOptionsResponse> {
    return this.runAuthorized(userId, request.projectId, "solo_options", "solo", (project) =>
      this.engineClient.soloOptions({ subjectId: userId, projectId: project.id }))
  }

  soloGenerate(
    userId: string,
    request: SoloGeneratePublicRequest,
  ): Promise<SoloGenerateResponse> {
    return this.runAuthorized(userId, request.projectId, "solo_generate", "solo", (project) => {
      const context = sectionContext(project, request.sectionId, request.contextRevision)
      return this.engineClient.soloGenerate(parseCreative(soloGenerateEngineRequestSchema, {
        subjectId: userId,
        projectId: project.id,
        model: request.model,
        optionsExpiresAt: request.optionsExpiresAt,
        instrumentOptionId: request.instrumentOptionId,
        styleOptionId: request.styleOptionId,
        ...(request.feel ? { feel: request.feel } : {}),
        takeCount: request.takeCount,
        context,
      }))
    })
  }

  soloRender(userId: string, request: SoloRenderPublicRequest): Promise<SoloRenderResponse> {
    return this.runAuthorized(userId, request.projectId, "solo_render", "solo", (project) =>
      this.engineClient.soloRender({
        subjectId: userId,
        projectId: project.id,
        takeId: request.takeId,
      }))
  }

  lyricGenerate(
    userId: string,
    request: LyricGeneratePublicRequest,
  ): Promise<LyricGenerationResponse> {
    return this.runAuthorized(userId, request.projectId, "lyrics_generate", "lyrics",
      (project, grantId) => this.engineClient.lyricGenerate(parseCreative(
        lyricGenerateEngineRequestSchema,
        {
        subjectId: userId,
        projectId: project.id,
        entitlement: { product: "lyrics", grantId },
        creative: request.creative,
        prosody: request.prosody,
        },
      )))
  }

  lyricFit(userId: string, request: LyricFitPublicRequest): Promise<LyricFitResponse> {
    const operation = request.operation === "fit" ? "lyrics_fit" : "lyrics_remap"
    return this.runAuthorized(userId, request.projectId, operation, "lyrics", (project) => {
      assertDisplayContextMatchesProject(project, request)
      return this.engineClient.lyricFit(parseCreative(lyricFitEngineRequestSchema, {
        subjectId: userId,
        projectId: project.id,
        operation: request.operation,
        ppq: request.ppq,
        tempoBpm: request.tempoBpm,
        key: request.key,
        timeSignature: request.timeSignature,
        chords: request.chords,
        notes: request.notes,
        lines: request.lines,
      }))
    })
  }

  private async runAuthorized<T>(
    userId: string,
    projectId: string,
    operation: EngineOperation,
    entitlement: "solo" | "lyrics",
    invoke: (project: ProjectDetail, grantId: string) => Promise<T>,
  ): Promise<T> {
    let project: ProjectDetail
    let grantId = ""
    try {
      if (entitlement === "solo") await this.requireSoloEntitlement(userId)
      else grantId = await this.requireLyricsEntitlement(userId)
      project = await this.loadProject(userId, projectId)
    } catch (error) {
      mapAccessError(error)
    }
    const startedAt = this.now()
    try {
      await assertWithinQuota({
        userId,
        store: this.usageStore,
        config: this.config,
        now: startedAt,
      })
    } catch (error) {
      if (error instanceof JamError && error.code === "quota_exceeded") {
        await this.record(userId, projectId, operation, "rejected", startedAt, error.code)
      }
      throw error
    }
    try {
      const result = await invoke(project, grantId)
      await this.record(userId, projectId, operation, "completed", startedAt)
      return result
    } catch (error) {
      await this.record(
        userId,
        projectId,
        operation,
        "failed",
        startedAt,
        error instanceof JamError ? error.code : "unavailable",
      )
      throw error
    }
  }

  private async record(
    userId: string,
    projectId: string,
    operation: EngineOperation,
    status: "completed" | "failed" | "rejected",
    startedAt: Date,
    errorCode?: string,
  ): Promise<void> {
    const finishedAt = this.now()
    await this.usageStore.record({
      id: this.createId(),
      userId,
      projectId,
      operation,
      status,
      errorCode,
      durationMs: status === "rejected" ? 0 : Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      createdAt: finishedAt,
    })
  }
}

export function createMemoryCreativeService(overrides: CreativeServiceDependencies = {}) {
  const usage = new MemoryEngineUsageStore()
  return {
    usage,
    service: new CreativeService({ ...overrides, usageStore: usage }),
  }
}
