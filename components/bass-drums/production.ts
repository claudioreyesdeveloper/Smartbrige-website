"use client"

import {
  createProjectSession,
  ProjectClientError,
  type ProjectSession,
  type ProjectSessionSnapshot,
} from "@/lib/projects/client"
import type { ProjectDocument, ProjectRecipe } from "@/lib/projects/document"
import {
  RhythmRenderedAuditionPlayer,
} from "@/lib/midi/audition"
import {
  parseRhythmFillsResponse,
  parseRhythmOptionsResponse,
  parseRhythmQueryResponse,
  parseRhythmRenderResponse,
} from "@/lib/rhythm/domain"
import type { KeyboardModel } from "@/lib/jam/domain/models"
import { getMidiSession, type YamahaMidiSession } from "@/lib/yamaha"
import {
  RhythmAdapterError,
  type AuditionState,
  type BassDrumsAdapters,
  type PreparedRhythmAudition,
  type RhythmCandidateQuery,
  type RhythmCandidateResult,
  type RhythmCandidateSummary,
  type RhythmFillSummary,
  type RhythmFilters,
  type RhythmPart,
  type RhythmProject,
} from "./types"

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type AuditionPlayback = (render: PreparedRhythmAudition, label: string) => Promise<void>

const MAX_PROJECTS = 50
const QUERY_LIMIT = 20
const FILL_LIMIT = 12
const RHYTHM_RECIPE_ENGINE_VERSION = "opaque-rhythm-v1"
const RECIPE_ENGINE_VERSION_MAX_LENGTH = 64

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function mapError(status: number, body: unknown): RhythmAdapterError {
  const serverCode = isObject(body) && typeof body.code === "string" ? body.code : ""
  const serverMessage =
    isObject(body) && typeof body.error === "string"
      ? body.error
      : "The rhythm service is temporarily unavailable."
  if (status === 401 || status === 403 || serverCode === "unauthenticated") {
    return new RhythmAdapterError("unauthorized", serverMessage)
  }
  if (status === 429 || serverCode === "quota_exceeded") {
    return new RhythmAdapterError("quota_exceeded", serverMessage)
  }
  if (status === 400 || status === 413 || serverCode === "validation") {
    return new RhythmAdapterError("validation", serverMessage)
  }
  return new RhythmAdapterError("unavailable", "The rhythm service is temporarily unavailable.")
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new RhythmAdapterError("unavailable", "The rhythm service returned an invalid response.")
  }
}

function createRhythmApi(fetchImpl: FetchLike) {
  async function post(path: string, body: unknown): Promise<unknown> {
    let response: Response
    try {
      response = await fetchImpl(path, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    } catch {
      throw new RhythmAdapterError("unavailable", "Could not reach the rhythm service.")
    }
    const parsed = await readJson(response)
    if (!response.ok) throw mapError(response.status, parsed)
    return parsed
  }
  return {
    options: (body: unknown) =>
      post("/api/engine/rhythm/options", body).then(parseRhythmOptionsResponse),
    query: (body: unknown) =>
      post("/api/engine/rhythm/query", body).then(parseRhythmQueryResponse),
    fills: (body: unknown) =>
      post("/api/engine/rhythm/fills", body).then(parseRhythmFillsResponse),
    render: (body: unknown) =>
      post("/api/engine/rhythm/render", body).then(parseRhythmRenderResponse),
  }
}

function appliedSummary(document: ProjectDocument): string | null {
  if (document.bass && document.drums) return "Bass & drums saved"
  if (document.bass) return "Bass saved"
  if (document.drums) return "Drums saved"
  return null
}

function projectFromSnapshot(snapshot: ProjectSessionSnapshot): RhythmProject {
  if (!snapshot.projectId || !snapshot.document || !snapshot.revisionId) {
    throw new ProjectClientError("validation", "No project document is open.")
  }
  const document = snapshot.document
  return {
    id: snapshot.projectId,
    title: document.song.title,
    tempo: document.song.tempo,
    key: document.song.key,
    appliedSummary: appliedSummary(document),
    sections: document.song.sections.map((section) => ({
      id: section.id,
      name: section.name,
      bars: section.bars ?? 0,
      chordContext: section.chords.map((chord) => chord.symbol).join("  ·  ") || "No chords",
      contextRevision: snapshot.revisionId!,
    })),
  }
}

async function openAndMap(session: ProjectSession, projectId: string): Promise<RhythmProject> {
  await session.open(projectId)
  const snapshot = session.getSnapshot()
  if (snapshot.projectId !== projectId) {
    throw new ProjectClientError("validation", "Project could not be opened.")
  }
  return projectFromSnapshot(snapshot)
}

export function createRhythmProjectAdapter(session: ProjectSession) {
  return {
    async list() {
      const summaries = (await session.list()).slice(0, MAX_PROJECTS)
      const projects: RhythmProject[] = []
      for (const summary of summaries) projects.push(await openAndMap(session, summary.id))
      if (summaries[0]) await session.open(summaries[0].id)
      return projects
    },
    open(projectId: string) {
      return openAndMap(session, projectId)
    },
  }
}

export type RhythmProjectReferenceUpdate = {
  part: RhythmPart
  recipeReferenceId: string
  renderReferenceId: string
  engineVersion: string
}

function recipeFromReference(update: RhythmProjectReferenceUpdate): ProjectRecipe {
  if (
    !update.recipeReferenceId.trim() ||
    !update.renderReferenceId.trim() ||
    !update.engineVersion.trim()
  ) {
    throw new ProjectClientError("validation", "Rhythm project references must be non-empty.")
  }
  if (update.engineVersion.length > RECIPE_ENGINE_VERSION_MAX_LENGTH) {
    throw new ProjectClientError("validation", "Rhythm engine version is too long.")
  }
  return {
    sourceId: update.recipeReferenceId,
    engineVersion: update.engineVersion,
    renderBlobId: update.renderReferenceId,
  }
}

export async function persistRhythmProjectReferences(
  session: ProjectSession,
  projectId: string,
  updates: readonly RhythmProjectReferenceUpdate[],
): Promise<RhythmProject> {
  if (session.getSnapshot().projectId !== projectId) await session.open(projectId)
  for (const update of updates) {
    const recipe = recipeFromReference(update)
    if (update.part === "bass") session.setBass(recipe)
    else session.setDrums(recipe)
  }
  const saved = await session.save()
  const snapshot = session.getSnapshot()
  if (!saved && snapshot.conflict) {
    throw new ProjectClientError("conflict", snapshot.conflict.message)
  }
  if (!saved) {
    throw new ProjectClientError(
      "internal",
      snapshot.lastError ?? "Project references could not be saved.",
    )
  }
  return projectFromSnapshot(snapshot)
}

function engineFilters(filters: RhythmFilters) {
  return {
    ...(filters.genre !== "All Genres" ? { genre: filters.genre } : {}),
    ...(filters.section !== "All Sections" ? { sectionType: filters.section } : {}),
    ...(filters.feel !== "All Feels"
      ? { feel: filters.feel.toLowerCase() === "swing" ? "swing" : "straight" }
      : {}),
  }
}

function candidateSummary(
  candidate: ReturnType<typeof parseRhythmQueryResponse>["candidates"][number],
  part: RhythmPart,
): RhythmCandidateSummary {
  const strength =
    candidate.matchBand === "strong"
      ? "Strong context match"
      : candidate.matchBand === "close"
        ? "Close context match"
        : "Broad context match"
  const quality =
    candidate.qualityBand === "high"
      ? "high detail"
      : candidate.qualityBand === "standard"
        ? "standard detail"
        : "limited detail"
  return {
    id: candidate.candidateId,
    name: candidate.label,
    genre: candidate.category,
    section: candidate.sectionType || "General",
    feel: candidate.feel || "Unspecified",
    bars: candidate.bars,
    summary: `${strength} · ${quality}`,
    audition: {
      candidateId: candidate.candidateId,
      part,
      durationLabel: `${candidate.bars} ${candidate.bars === 1 ? "bar" : "bars"}`,
    },
  }
}

function mapQuery(
  response: ReturnType<typeof parseRhythmQueryResponse>,
  query: RhythmCandidateQuery,
  mode: "browse" | "suggested",
): RhythmCandidateResult {
  return {
    candidates: response.candidates.map((candidate) => candidateSummary(candidate, query.part)),
    total: response.candidates.length,
    contextLabel:
      mode === "suggested"
        ? "Suggested drums updated for this chord context"
        : "Updated for this chord context",
  }
}

export function createProductionBassDrumsAdapters(options: {
  fetch?: FetchLike
  projects?: ProjectSession
  model?: KeyboardModel
  playAudition?: AuditionPlayback
  midiSession?: YamahaMidiSession
} = {}): BassDrumsAdapters {
  const fetchImpl = options.fetch ?? fetch
  const projectSession = options.projects ?? createProjectSession({ fetch: fetchImpl })
  const projectAdapter = createRhythmProjectAdapter(projectSession)
  const api = createRhythmApi(fetchImpl)
  const model = options.model ?? "genos2"
  const midiSession = options.midiSession ?? getMidiSession()
  const renderedPlayer = options.playAudition
    ? null
    : new RhythmRenderedAuditionPlayer({
        session: midiSession,
      })
  const listeners = new Set<(state: AuditionState) => void>()
  let auditionState: AuditionState = {
    status: "idle",
    renderReferenceId: null,
    label: null,
    error: null,
  }
  const emit = () => {
    for (const listener of listeners) listener({ ...auditionState })
  }

  const query = async (
    input: RhythmCandidateQuery,
    mode: "browse" | "suggested",
    bassCandidateId?: string,
  ) => {
    const response = await api.query({
      projectId: input.projectId,
      sectionId: input.sectionId,
      contextRevision: input.contextRevision,
      kind: input.part,
      mode,
      filters: engineFilters(input.filters),
      ...(bassCandidateId ? { bassCandidateId } : {}),
      limit: QUERY_LIMIT,
    })
    return mapQuery(response, input, mode)
  }

  return {
    projects: {
      list: () => projectAdapter.list(),
      open: (projectId) => projectAdapter.open(projectId),
    },
    library: {
      async getFilterOptions(part, projectId) {
        const response = await api.options({ projectId, kind: part })
        return {
          genres: ["All Genres", ...response.genres],
          sections: ["All Sections", ...response.sectionTypes],
          feels: ["All Feels", ...response.feels],
        }
      },
      queryCandidates(input) {
        return query(input, "browse")
      },
      getSuggestedDrums(input) {
        return query({ ...input, part: "drums" }, "suggested", input.bassCandidateId)
      },
      async getFills(input) {
        const response = await api.fills({
          projectId: input.projectId,
          sectionId: input.sectionId,
          contextRevision: input.contextRevision,
          drumCandidateId: input.drumCandidateId,
          limit: FILL_LIMIT,
        })
        return response.fills.map(
          (fill): RhythmFillSummary => ({
            id: fill.candidateId,
            name: fill.label,
            feel: fill.feel || "Unspecified",
            lengthLabel: `${fill.bars} ${fill.bars === 1 ? "bar" : "bars"}`,
            audition: {
              candidateId: fill.candidateId,
              part: "fill",
              durationLabel: `${fill.bars} ${fill.bars === 1 ? "bar" : "bars"}`,
            },
          }),
        )
      },
      async prepareAudition(input) {
        const response = await api.render({
          projectId: input.projectId,
          sectionId: input.sectionId,
          contextRevision: input.contextRevision,
          model,
          operation: "audition",
          part: input.source.part,
          candidateId: input.source.candidateId,
        })
        const render = response.renders[0]!
        return {
          renderReferenceId: render.renderReferenceId,
          recipeReferenceId: render.recipeReferenceId,
          durationMs: render.durationMs,
          durationLabel: input.source.durationLabel,
          renderedSmf: render.renderedSmf,
          playback: render.playback,
        }
      },
      async applyToSong(request) {
        const fillSlots = Object.entries(request.fillCandidateIdsBySlot).map(
          ([slot, candidateId]) => ({
            slotBar: (Number(slot) + 1) * 4,
            candidateId,
          }),
        )
        const response = await api.render({
          projectId: request.projectId,
          sectionId: request.sectionId,
          contextRevision: request.contextRevision,
          model,
          operation: "apply",
          ...(request.bassCandidateId ? { bassCandidateId: request.bassCandidateId } : {}),
          ...(request.drumCandidateId ? { drumCandidateId: request.drumCandidateId } : {}),
          ...(fillSlots.length ? { fillSlots } : {}),
        })
        const parts = response.renders.map((render) => render.part)
        const label =
          parts.includes("bass") && parts.includes("drums")
            ? "Bass & drums"
            : parts.includes("bass")
              ? "Bass"
              : "Drums"
        const project = await persistRhythmProjectReferences(
          projectSession,
          request.projectId,
          response.renders
            .filter((render) => render.part !== "fill")
            .map((render) => ({
              part: render.part as RhythmPart,
              recipeReferenceId: render.recipeReferenceId,
              renderReferenceId: render.renderReferenceId,
              engineVersion: RHYTHM_RECIPE_ENGINE_VERSION,
            })),
        )
        const section = project.sections.find((item) => item.id === request.sectionId)
        const message = `${label} applied to ${section?.name ?? "section"}`
        return {
          project: { ...project, appliedSummary: message },
          appliedReferences: response.renders
            .filter((render) => render.part !== "fill")
            .map((render) => ({
              part: render.part as RhythmPart,
              recipeReferenceId: render.recipeReferenceId,
              renderReferenceId: render.renderReferenceId,
              statusLabel: `${render.part === "bass" ? "Bass" : "Drums"} render ready`,
            })),
          message: `${message}. Recipe and render references saved.`,
        }
      },
    },
    audition: {
      getState: () => ({ ...auditionState }),
      async play(render, label) {
        if (options.playAudition) await options.playAudition(render, label)
        else {
          if (!midiSession.state.connected) {
            const connected = await midiSession.requestAccess(model)
            if (!connected.connected) {
              throw new RhythmAdapterError(
                "unavailable",
                connected.error || "Connect the Yamaha keyboard before auditioning.",
              )
            }
          }
          renderedPlayer!.start({
            part: render.playback.kind === "drum-kit" ||
              render.playback.kind === "channel-current" ? "drums" : "bass",
            durationMs: render.durationMs,
            renderedSmf: render.renderedSmf,
            playback: render.playback,
          })
        }
        auditionState = {
          status: "playing",
          renderReferenceId: render.renderReferenceId,
          label,
          error: null,
        }
        emit()
      },
      stop() {
        renderedPlayer?.stop()
        auditionState = {
          status: "stopped",
          renderReferenceId: null,
          label: null,
          error: null,
        }
        emit()
      },
      subscribe(listener) {
        listeners.add(listener)
        listener({ ...auditionState })
        return () => listeners.delete(listener)
      },
    },
  }
}
