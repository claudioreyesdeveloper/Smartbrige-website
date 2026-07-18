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
import type { DisplayChord } from "@/lib/jam/domain/types"
import type { ProjectDetail } from "@/lib/projects/service"
import { getProjectService } from "@/lib/projects/runtime"
import type { ProjectSection, ProjectStylePart } from "@/lib/projects/document"
import { ProjectError } from "@/lib/projects/errors"
import type {
  RhythmFillsRequest,
  RhythmFillsResponse,
  RhythmOperation,
  RhythmOptionsRequest,
  RhythmOptionsResponse,
  RhythmQueryRequest,
  RhythmQueryResponse,
  RhythmRenderContext,
  RhythmRenderRequest,
  RhythmRenderResponse,
} from "@/lib/rhythm/domain"

export type RhythmServiceDependencies = {
  usageStore?: EngineUsageStore
  engineClient?: PrivateEngineClient
  config?: EngineProxyConfig
  requireEntitlement?: (userId: string) => Promise<void>
  loadProject?: (userId: string, projectId: string) => Promise<ProjectDetail>
  now?: () => Date
  createId?: () => string
}

const SECTION_TYPES: Partial<Record<ProjectStylePart, string>> = {
  intro: "intro",
  mainA: "verse",
  mainB: "verse",
  mainC: "chorus",
  mainD: "chorus",
  fill: "fill",
  break: "break",
  ending: "ending",
}

function mapAuthorization(error: unknown): never {
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
  if (error instanceof ProjectError) {
    throw new JamError(
      error.code === "unauthenticated"
        ? "unauthenticated"
        : error.code === "not_found"
          ? "not_found"
          : error.code === "forbidden"
            ? "forbidden"
            : error.code === "payload_too_large"
              ? "payload_too_large"
              : "validation",
      error.message,
    )
  }
  throw error
}

function sectionBars(section: ProjectSection): number {
  if (
    typeof section.bars !== "number" ||
    !Number.isInteger(section.bars) ||
    section.bars < 1 ||
    section.bars > 256
  ) {
    throw new JamError("validation", "The project section must have 1–256 whole bars.")
  }
  return section.bars
}

function displayChords(section: ProjectSection, bars: number): DisplayChord[] {
  const sorted = [...section.chords].sort((left, right) => left.startBeat - right.startBeat)
  if (!sorted.length) return []
  return sorted.map((chord, index) => {
    const nextStart = sorted[index + 1]?.startBeat ?? bars * 4
    const durationBeats = chord.durationBeats ?? nextStart - chord.startBeat
    if (
      !Number.isFinite(chord.startBeat) ||
      chord.startBeat < 0 ||
      !Number.isFinite(durationBeats) ||
      durationBeats <= 0
    ) {
      throw new JamError("validation", "The project section has invalid chord timing.")
    }
    return {
      symbol: chord.symbol,
      startBar: chord.startBeat / 4,
      durationBars: durationBeats / 4,
    }
  })
}

function assertRenderCoverage(chords: DisplayChord[], bars: number): void {
  if (!chords.length) {
    throw new JamError("validation", "Rhythm rendering requires section chords.")
  }
  let cursor = 0
  for (const chord of chords) {
    if (Math.abs(chord.startBar - cursor) > 1e-6) {
      throw new JamError(
        "validation",
        "Section chords must exactly and contiguously cover the section.",
      )
    }
    cursor += chord.durationBars
  }
  if (Math.abs(cursor - bars) > 1e-6) {
    throw new JamError(
      "validation",
      "Section chords must exactly and contiguously cover the section.",
    )
  }
}

function resolveSection(
  project: ProjectDetail,
  sectionId: string,
  revision: string,
): { section: ProjectSection; bars: number; chords: DisplayChord[] } {
  if (project.revisionId !== revision) {
    throw new JamError("validation", "Chord context changed. Refresh candidates and try again.")
  }
  const section = project.document.song.sections.find((item) => item.id === sectionId)
  if (!section) throw new JamError("not_found", "Project section was not found.")
  const bars = sectionBars(section)
  return { section, bars, chords: displayChords(section, bars) }
}

function renderContext(
  project: ProjectDetail,
  section: ProjectSection,
  bars: number,
  chords: DisplayChord[],
): RhythmRenderContext {
  assertRenderCoverage(chords, bars)
  const bpm = project.document.song.tempo
  if (!Number.isInteger(bpm) || bpm < 40 || bpm > 400) {
    throw new JamError("validation", "Rhythm rendering requires a 40–400 whole-number tempo.")
  }
  return {
    sectionId: section.id,
    sectionName: section.name,
    sectionType: section.stylePart ? (SECTION_TYPES[section.stylePart] ?? "section") : "section",
    bars,
    bpm,
    key: project.document.song.key,
    timeSignature: { numerator: 4, denominator: 4 },
    chords,
  }
}

export class RhythmService {
  private readonly usageStore: EngineUsageStore
  private readonly engineClient: PrivateEngineClient
  private readonly config: EngineProxyConfig
  private readonly requireEntitlement: (userId: string) => Promise<void>
  private readonly loadProject: (userId: string, projectId: string) => Promise<ProjectDetail>
  private readonly now: () => Date
  private readonly createId: () => string

  constructor(deps: RhythmServiceDependencies = {}) {
    this.config = deps.config ?? readEngineProxyConfig()
    this.usageStore = deps.usageStore ?? new NeonEngineUsageStore()
    this.engineClient = deps.engineClient ?? new PrivateEngineClient({ config: this.config })
    this.requireEntitlement =
      deps.requireEntitlement ??
      ((userId) => requireServiceEntitlement(userId, "bass-drums"))
    this.loadProject =
      deps.loadProject ??
      ((userId, projectId) => getProjectService().load(userId, projectId))
    this.now = deps.now ?? (() => new Date())
    this.createId = deps.createId ?? (() => crypto.randomUUID())
  }

  async options(userId: string, request: RhythmOptionsRequest): Promise<RhythmOptionsResponse> {
    return this.runAuthorized(userId, request.projectId, "rhythm_browse", async () => {
      return this.engineClient.rhythmOptions({
        subjectId: userId,
        projectId: request.projectId,
        kind: request.kind,
      })
    })
  }

  async query(userId: string, request: RhythmQueryRequest): Promise<RhythmQueryResponse> {
    return this.runAuthorized(userId, request.projectId, "rhythm_browse", async (project) => {
      const { section, bars, chords } = resolveSection(
        project,
        request.sectionId,
        request.contextRevision,
      )
      const bpm = project.document.song.tempo
      if (!Number.isInteger(bpm) || bpm < 20 || bpm > 400) {
        throw new JamError("validation", "Rhythm browsing requires a whole-number tempo.")
      }
      return this.engineClient.rhythmQuery({
        subjectId: userId,
        projectId: project.id,
        kind: request.kind,
        mode: request.mode,
        context: {
          sectionId: section.id,
          sectionName: section.name,
          bars,
          bpm,
          key: project.document.song.key,
          timeSignature: { numerator: 4, denominator: 4 },
          ...(chords.length ? { chords } : {}),
        },
        filters: request.filters,
        ...(request.bassCandidateId ? { bassCandidateId: request.bassCandidateId } : {}),
        limit: request.limit,
      })
    })
  }

  async fills(userId: string, request: RhythmFillsRequest): Promise<RhythmFillsResponse> {
    return this.runAuthorized(userId, request.projectId, "rhythm_fills", async (project) => {
      resolveSection(project, request.sectionId, request.contextRevision)
      return this.engineClient.rhythmFills({
        subjectId: userId,
        projectId: project.id,
        drumCandidateId: request.drumCandidateId,
        limit: request.limit,
      })
    })
  }

  async render(userId: string, request: RhythmRenderRequest): Promise<RhythmRenderResponse> {
    return this.runAuthorized(userId, request.projectId, "rhythm_render", async (project) => {
      const { section, bars, chords } = resolveSection(
        project,
        request.sectionId,
        request.contextRevision,
      )
      const context = renderContext(project, section, bars, chords)
      if (request.operation === "apply" && request.fillSlots) {
        const slots = request.fillSlots.map((slot) => slot.slotBar)
        if (
          slots.some((slot) => slot % 4 !== 0 || slot > bars) ||
          new Set(slots).size !== slots.length
        ) {
          throw new JamError(
            "validation",
            "Fill slots must be unique four-bar boundaries in the section.",
          )
        }
      }
      const common = {
        subjectId: userId,
        projectId: project.id,
        model: request.model,
        context,
        ...(request.options ? { options: request.options } : {}),
      }
      return request.operation === "audition"
        ? this.engineClient.rhythmRender({
            ...common,
            operation: "audition",
            part: request.part,
            candidateId: request.candidateId,
          })
        : this.engineClient.rhythmRender({
            ...common,
            operation: "apply",
            ...(request.bassCandidateId ? { bassCandidateId: request.bassCandidateId } : {}),
            ...(request.drumCandidateId ? { drumCandidateId: request.drumCandidateId } : {}),
            ...(request.fillSlots ? { fillSlots: request.fillSlots } : {}),
          })
    })
  }

  private async loadOwnedProject(userId: string, projectId: string): Promise<ProjectDetail> {
    try {
      return await this.loadProject(userId, projectId)
    } catch (error) {
      mapAuthorization(error)
    }
  }

  private async runAuthorized<T>(
    userId: string,
    projectId: string,
    operation: RhythmOperation,
    invoke: (project: ProjectDetail) => Promise<T>,
  ): Promise<T> {
    let project: ProjectDetail
    try {
      await this.requireEntitlement(userId)
      project = await this.loadOwnedProject(userId, projectId)
    } catch (error) {
      mapAuthorization(error)
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
        await this.usageStore.record({
          id: this.createId(),
          userId,
          projectId,
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
      const result = await invoke(project)
      const finishedAt = this.now()
      await this.usageStore.record({
        id: this.createId(),
        userId,
        projectId,
        operation,
        status: "completed",
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
        createdAt: finishedAt,
      })
      return result
    } catch (error) {
      const finishedAt = this.now()
      await this.usageStore.record({
        id: this.createId(),
        userId,
        projectId,
        operation,
        status: "failed",
        errorCode: error instanceof JamError ? error.code : "unavailable",
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
        createdAt: finishedAt,
      })
      throw error
    }
  }
}

export function createMemoryRhythmService(
  overrides: RhythmServiceDependencies = {},
): { service: RhythmService; usage: MemoryEngineUsageStore } {
  const usage = new MemoryEngineUsageStore()
  return {
    usage,
    service: new RhythmService({ usageStore: usage, ...overrides }),
  }
}
