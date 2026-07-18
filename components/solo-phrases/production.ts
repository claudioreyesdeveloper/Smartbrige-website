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
import type { z } from "zod"

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
  const model = options.model ?? "genos2"
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
