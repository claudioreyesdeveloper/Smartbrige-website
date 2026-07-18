"use client"

import {
  parseCreative,
  soloGenerateResponseSchema,
  soloOptionsResponseSchema,
  soloRenderResponseSchema,
  type SoloGeneratePublicRequest,
  type SoloGenerateResponse,
  type SoloOptionsResponse,
  type SoloRenderResponse,
} from "@/lib/creative/contracts"
import type { KeyboardModel } from "@/lib/jam/domain/models"
import { RhythmRenderedAuditionPlayer } from "@/lib/midi/audition"
import { createProjectSession, ProjectClientError, type ProjectSession } from "@/lib/projects/client"
import type { ProjectSoloTake } from "@/lib/projects/document"
import { getMidiSession, type YamahaMidiSession } from "@/lib/yamaha"
import { getPreferredKeyboardModel } from "@/lib/yamaha/preferred-model"
import type { z } from "zod"
import type {
  PreparedSoloAudition,
  SavedSoloTake,
  SoloOptionCatalog,
  SoloPhrasesAdapters,
  SoloPlaybackState,
  SoloProject,
  SoloSelections,
  SoloTakeSummary,
} from "./types"

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export class SoloAdapterError extends Error {
  constructor(
    readonly code: "unauthorized" | "validation" | "quota_exceeded" | "unavailable",
    message: string,
  ) {
    super(message)
    this.name = "SoloAdapterError"
  }
}

function safeError(status: number, value: unknown): SoloAdapterError {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const code = typeof body.code === "string" ? body.code : ""
  if (status === 401 || status === 403 || code === "unauthenticated" || code === "forbidden") {
    return new SoloAdapterError("unauthorized", "Solo Phrases access is required.")
  }
  if (status === 429 || code === "quota_exceeded") {
    return new SoloAdapterError("quota_exceeded", "Usage limit exceeded. Try again later.")
  }
  if (status === 400 || status === 404 || status === 413 || code === "validation") {
    return new SoloAdapterError("validation", "Solo request validation failed.")
  }
  return new SoloAdapterError("unavailable", "The Solo Phrases service is temporarily unavailable.")
}

function createApi(fetchImpl: FetchLike) {
  async function post<T>(path: string, body: unknown, schema: z.ZodType<T>) {
    let response: Response
    try {
      response = await fetchImpl(path, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      })
    } catch {
      throw new SoloAdapterError("unavailable", "Could not reach the Solo Phrases service.")
    }
    let value: unknown
    try {
      value = await response.json()
    } catch {
      throw new SoloAdapterError("unavailable", "The Solo Phrases service returned an invalid response.")
    }
    if (!response.ok) throw safeError(response.status, value)
    try {
      return parseCreative(schema, value)
    } catch {
      throw new SoloAdapterError("unavailable", "The Solo Phrases service returned an invalid response.")
    }
  }
  return {
    options: (projectId: string) =>
      post<SoloOptionsResponse>("/api/engine/solo/options", { projectId }, soloOptionsResponseSchema),
    generate: (request: SoloGeneratePublicRequest) =>
      post<SoloGenerateResponse>("/api/engine/solo/generate", request, soloGenerateResponseSchema),
    render: (projectId: string, takeId: string) =>
      post<SoloRenderResponse>("/api/engine/solo/render", { projectId, takeId }, soloRenderResponseSchema),
  }
}

export async function persistSoloSelection(
  session: ProjectSession,
  input: {
    projectId: string
    sectionId?: string
    render: SoloRenderResponse
    instrumentLabel?: string
    styleLabel?: string
  },
): Promise<void> {
  if (session.getSnapshot().projectId !== input.projectId) await session.open(input.projectId)
  const snapshot = session.getSnapshot()
  if (!snapshot.document) throw new ProjectClientError("validation", "No project document is open.")
  const take: ProjectSoloTake = {
    id: input.render.renderId,
    ...(input.sectionId ? { sectionId: input.sectionId } : {}),
    recipe: {
      sourceId: input.render.recipeId,
      engineVersion: "opaque-solo-v1",
      renderBlobId: input.render.renderId,
    },
    ...(input.instrumentLabel ? { instrument: input.instrumentLabel } : {}),
    ...(input.styleLabel ? { style: input.styleLabel } : {}),
    selected: true,
  }
  const previous = (snapshot.document.solos ?? [])
    .filter((item) => item.id !== take.id)
    .map((item) => ({ ...item, selected: false }))
  session.updateDocument({
    ...snapshot.document,
    solos: [...previous, take].slice(-64),
  })
  const saved = await session.save()
  const next = session.getSnapshot()
  if (!saved && next.conflict) throw new ProjectClientError("conflict", next.conflict.message)
  if (!saved) {
    throw new ProjectClientError(
      "internal",
      next.lastError ?? `Solo selection could not be saved (${next.saveState}).`,
    )
  }
}

export function createProductionSoloAdapters(options: {
  fetch?: FetchLike
  projects?: ProjectSession
  midiSession?: YamahaMidiSession
  model?: KeyboardModel
} = {}) {
  const fetchImpl = options.fetch ?? fetch
  const projects = options.projects ?? createProjectSession({ fetch: fetchImpl })
  const api = createApi(fetchImpl)
  const midiSession = options.midiSession ?? getMidiSession()
  const model =
    options.model ??
    getPreferredKeyboardModel() ??
    midiSession.state.profile?.id ??
    "genos2"
  const player = new RhythmRenderedAuditionPlayer({ session: midiSession })

  return {
    projects,
    library: {
      options: api.options,
      generate: api.generate,
      select(response: SoloGenerateResponse, takeId: string) {
        const take = response.takes.find((item) => item.takeId === takeId)
        if (!take) throw new SoloAdapterError("validation", "The selected Solo take is unavailable.")
        return take
      },
      render: api.render,
      persistSelection: (input: Parameters<typeof persistSoloSelection>[1]) =>
        persistSoloSelection(projects, input),
    },
    audition: {
      async play(render: SoloRenderResponse) {
        if (!midiSession.state.connected) {
          const state = await midiSession.requestAccess(model)
          if (!state.connected) {
            throw new SoloAdapterError("unavailable", state.error || "Connect the Yamaha keyboard first.")
          }
        }
        player.start({
          part: "solo",
          durationMs: render.durationMs,
          renderedSmf: render.renderedSmf,
          playback: render.playback,
        })
      },
      stop: () => player.stop(),
      subscribe: player.subscribe.bind(player),
    },
  }
}

const SOLO_LINE_FEELS = [
  { id: "safe", label: "Safe" },
  { id: "balanced", label: "Balanced" },
  { id: "expressive", label: "Expressive" },
]
const SOLO_GROOVES = [
  { id: "auto", label: "Auto (from style)" },
  { id: "straight", label: "Straight" },
  { id: "swing", label: "Swing" },
]
const SOLO_VOICINGS = [{ id: "match", label: "Match Setup" }]

function durationLabel(durationMs: number): string {
  const seconds = Math.max(1, Math.round(durationMs / 1000))
  return `${seconds} sec`
}

function mapSoloProject(session: ProjectSession): SoloProject {
  const snapshot = session.getSnapshot()
  if (!snapshot.projectId || !snapshot.document || !snapshot.revisionId) {
    throw new ProjectClientError("validation", "No project document is open.")
  }
  const savedTakeBySection: Record<string, SavedSoloTake> = {}
  for (const take of snapshot.document.solos ?? []) {
    if (!take.selected || !take.sectionId || !take.recipe.renderBlobId) continue
    savedTakeBySection[take.sectionId] = {
      takeId: take.id,
      renderReferenceId: take.recipe.renderBlobId,
      recipeReferenceId: take.recipe.sourceId,
      label: "Saved take",
      durationLabel: "Saved",
      instrumentLabel: take.instrument ?? "Current voice",
      styleLabel: take.style ?? "Current style",
      statusLabel: "Selected for this section",
    }
  }
  return {
    id: snapshot.projectId,
    title: snapshot.document.song.title,
    tempoLabel: `${snapshot.document.song.tempo} bpm`,
    keyLabel: snapshot.document.song.key,
    savedTakeBySection,
    sections: snapshot.document.song.sections.map((section) => ({
      id: section.id,
      name: section.name,
      bars: section.bars ?? 0,
      chordContextLabel:
        section.chords.map((chord) => chord.symbol).join("  ·  ") || "No chords",
      contextRevision: snapshot.revisionId!,
    })),
  }
}

function optionLabel(
  options: SoloOptionCatalog,
  group: keyof SoloOptionCatalog,
  id: string,
): string {
  return options[group].find((item) => item.id === id)?.label ?? "Auto"
}

export function createProductionSoloPhrasesAdapters(options: {
  fetch?: FetchLike
  projects?: ProjectSession
  midiSession?: YamahaMidiSession
  model?: KeyboardModel
} = {}): SoloPhrasesAdapters {
  const base = createProductionSoloAdapters(options)
  const projects = base.projects
  const rendered = new Map<string, SoloRenderResponse>()
  const takes = new Map<string, SoloTakeSummary>()
  let catalog: SoloOptionCatalog = {
    instruments: [],
    styles: [],
    lineFeels: SOLO_LINE_FEELS,
    grooves: SOLO_GROOVES,
    voicings: SOLO_VOICINGS,
  }
  let optionsExpiresAt = ""
  let playback: SoloPlaybackState = {
    status: "idle",
    takeId: null,
    label: null,
    statusLabel: "Ready",
  }
  const listeners = new Set<(state: SoloPlaybackState) => void>()
  const emit = () => {
    for (const listener of listeners) listener({ ...playback })
  }

  async function open(projectId: string): Promise<SoloProject> {
    await projects.open(projectId)
    return mapSoloProject(projects)
  }

  return {
    projects: {
      async list() {
        const summaries = await projects.list()
        const result: SoloProject[] = []
        for (const summary of summaries) result.push(await open(summary.id))
        if (summaries[0]) await projects.open(summaries[0].id)
        return result
      },
      open,
    },
    generator: {
      async getOptions(projectId) {
        const response = await base.library.options(projectId)
        optionsExpiresAt = response.expiresAt
        catalog = {
          instruments: response.instruments.map((item) => ({ id: item.optionId, label: item.label })),
          styles: response.styles.map((item) => ({ id: item.optionId, label: item.label })),
          lineFeels: SOLO_LINE_FEELS,
          grooves: SOLO_GROOVES,
          voicings: SOLO_VOICINGS,
        }
        return catalog
      },
      async generateTakes(request) {
        const response = await base.library.generate({
          projectId: request.projectId,
          sectionId: request.sectionId,
          contextRevision: request.contextRevision,
          model: options.model ?? "genos2",
          optionsExpiresAt,
          instrumentOptionId: request.selections.instrumentId,
          styleOptionId: request.selections.styleId,
          ...(request.selections.grooveId === "straight" ||
          request.selections.grooveId === "swing"
            ? { feel: request.selections.grooveId }
            : {}),
          takeCount: request.takeCount,
        })
        const mapped = response.takes.map((take, index): SoloTakeSummary => ({
          takeId: take.takeId,
          label: take.label,
          description: `Generated alternative ${index + 1} for this section.`,
          durationLabel: durationLabel(take.durationMs),
          instrumentLabel: optionLabel(catalog, "instruments", request.selections.instrumentId),
          styleLabel: optionLabel(catalog, "styles", request.selections.styleId),
          lineFeelLabel: optionLabel(catalog, "lineFeels", request.selections.lineFeelId),
          grooveLabel: optionLabel(catalog, "grooves", request.selections.grooveId),
          playbackStatus: "ready",
        }))
        for (const take of mapped) takes.set(take.takeId, take)
        return {
          takes: mapped,
          contextStatusLabel: `${mapped.length} takes ready`,
        }
      },
      async prepareAudition(input) {
        const render = await base.library.render(input.projectId, input.takeId)
        rendered.set(input.takeId, render)
        return {
          takeId: input.takeId,
          renderReferenceId: render.renderId,
          recipeReferenceId: render.recipeId,
          durationLabel: durationLabel(render.durationMs),
          playbackStatusLabel: "Ready to audition",
        }
      },
      async saveTake(request) {
        const render = rendered.get(request.take.takeId)
        if (!render || render.renderId !== request.audition.renderReferenceId) {
          throw new SoloAdapterError("validation", "Prepare the selected take before saving.")
        }
        await persistSoloSelection(projects, {
          projectId: request.projectId,
          sectionId: request.sectionId,
          render,
          instrumentLabel: request.take.instrumentLabel,
          styleLabel: request.take.styleLabel,
        })
        const project = mapSoloProject(projects)
        const savedTake = project.savedTakeBySection[request.sectionId]!
        return {
          project,
          savedTake: { ...savedTake, label: request.take.label },
          message: `${request.take.label} saved`,
        }
      },
    },
    audition: {
      getState: () => ({ ...playback }),
      async start(audition: PreparedSoloAudition, label: string) {
        const render = rendered.get(audition.takeId)
        if (!render) throw new SoloAdapterError("validation", "Prepare this take before auditioning.")
        await base.audition.play(render)
        playback = {
          status: "playing",
          takeId: audition.takeId,
          label,
          statusLabel: `Playing ${label}`,
        }
        emit()
      },
      stop() {
        base.audition.stop()
        playback = {
          status: "stopped",
          takeId: null,
          label: null,
          statusLabel: "Audition stopped",
        }
        emit()
      },
      subscribe(listener) {
        listeners.add(listener)
        listener({ ...playback })
        return () => listeners.delete(listener)
      },
    },
  }
}
