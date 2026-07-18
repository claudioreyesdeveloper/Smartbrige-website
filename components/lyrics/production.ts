"use client"

import {
  lyricFitResponseSchema,
  lyricGenerateResponseSchema,
  parseCreative,
  type LyricFitPublicRequest,
  type LyricFitResponse,
  type LyricGeneratePublicRequest,
  type LyricGenerationResponse,
} from "@/lib/creative/contracts"
import { createProjectSession, ProjectClientError, type ProjectSession } from "@/lib/projects/client"
import type { ProjectLyricSyllable } from "@/lib/projects/document"
import type { z } from "zod"

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type Download = (filename: string, bytes: Uint8Array, contentType: string) => void

export class LyricsAdapterError extends Error {
  constructor(
    readonly code: "unauthorized" | "validation" | "quota_exceeded" | "unavailable",
    message: string,
  ) {
    super(message)
    this.name = "LyricsAdapterError"
  }
}

function mapError(status: number, value: unknown): LyricsAdapterError {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const code = typeof body.code === "string" ? body.code : ""
  if (status === 401 || status === 403 || code === "unauthenticated" || code === "forbidden") {
    return new LyricsAdapterError("unauthorized", "Lyrics access is required.")
  }
  if (status === 429 || code === "quota_exceeded") {
    return new LyricsAdapterError("quota_exceeded", "Usage limit exceeded. Try again later.")
  }
  if (status === 400 || status === 404 || status === 413 || code === "validation") {
    return new LyricsAdapterError("validation", "Lyrics request validation failed.")
  }
  return new LyricsAdapterError("unavailable", "The Lyrics service is temporarily unavailable.")
}

function createApi(fetchImpl: FetchLike) {
  async function post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    let response: Response
    try {
      response = await fetchImpl(path, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      })
    } catch {
      throw new LyricsAdapterError("unavailable", "Could not reach the Lyrics service.")
    }
    let value: unknown
    try {
      value = await response.json()
    } catch {
      throw new LyricsAdapterError("unavailable", "The Lyrics service returned an invalid response.")
    }
    if (!response.ok) throw mapError(response.status, value)
    try {
      return parseCreative(schema, value)
    } catch {
      throw new LyricsAdapterError("unavailable", "The Lyrics service returned an invalid response.")
    }
  }
  return {
    generate: (request: LyricGeneratePublicRequest) =>
      post<LyricGenerationResponse>(
        "/api/engine/lyrics/generate",
        request,
        lyricGenerateResponseSchema,
      ),
    fit: (request: LyricFitPublicRequest) =>
      post<LyricFitResponse>("/api/engine/lyrics/fit", request, lyricFitResponseSchema),
  }
}

function defaultDownload(filename: string, bytes: Uint8Array, contentType: string): void {
  const blob = new Blob([bytes as BlobPart], { type: contentType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function decodeCanonicalBase64(value: string): Uint8Array {
  const decoded = atob(value)
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

async function saveLyrics(
  session: ProjectSession,
  projectId: string,
  update: {
    text: string
    syllables?: ProjectLyricSyllable[]
    recipeReferenceId?: string
    renderReferenceId?: string
  },
): Promise<void> {
  if (session.getSnapshot().projectId !== projectId) await session.open(projectId)
  const snapshot = session.getSnapshot()
  if (!snapshot.document) throw new ProjectClientError("validation", "No project document is open.")
  session.updateDocument({
    ...snapshot.document,
    lyrics: {
      text: update.text,
      ...(update.syllables ? { syllables: update.syllables } : {}),
      ...(update.recipeReferenceId ? { recipeReferenceId: update.recipeReferenceId } : {}),
      ...(update.renderReferenceId ? { renderReferenceId: update.renderReferenceId } : {}),
    },
  })
  const saved = await session.save()
  const next = session.getSnapshot()
  if (!saved && next.conflict) throw new ProjectClientError("conflict", next.conflict.message)
  if (!saved) {
    throw new ProjectClientError("internal", next.lastError ?? "Lyrics could not be saved.")
  }
}

export function createProductionLyricsAdapters(options: {
  fetch?: FetchLike
  projects?: ProjectSession
  download?: Download
} = {}) {
  const fetchImpl = options.fetch ?? fetch
  const projects = options.projects ?? createProjectSession({ fetch: fetchImpl })
  const api = createApi(fetchImpl)
  const download = options.download ?? defaultDownload

  return {
    projects,
    lyrics: {
      generate: api.generate,
      fit(request: Omit<LyricFitPublicRequest, "operation">) {
        return api.fit({ ...request, operation: "fit" })
      },
      remap(request: Omit<LyricFitPublicRequest, "operation">) {
        return api.fit({ ...request, operation: "remap" })
      },
      render(response: LyricFitResponse) {
        return {
          recipeReferenceId: response.recipeReferenceId,
          renderReferenceId: response.renderReferenceId,
          renderedExport: response.renderedExport,
        }
      },
      export(response: LyricFitResponse, filename = "lyrics.mid") {
        download(filename, decodeCanonicalBase64(response.renderedExport), "audio/midi")
      },
      persistDraft(projectId: string, response: LyricGenerationResponse) {
        return saveLyrics(
          projects,
          projectId,
          { text: response.lines.map((line) => line.text).join("\n") },
        )
      },
      persistFit(projectId: string, response: LyricFitResponse) {
        return saveLyrics(projects, projectId, {
          text: response.phrases
            .map((phrase) => phrase.words.join(" "))
            .join("\n"),
          syllables: response.phrases.flatMap((phrase) =>
            phrase.syllables.map((text) => ({ text }))),
          recipeReferenceId: response.recipeReferenceId,
          renderReferenceId: response.renderReferenceId,
        })
      },
    },
  }
}
