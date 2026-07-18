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
import type {
  ProjectDocument,
  ProjectLyricSyllable,
  ProjectSection,
} from "@/lib/projects/document"
import type { KeyboardModel } from "@/lib/jam/domain/models"
import { RhythmRenderedAuditionPlayer } from "@/lib/midi/audition"
import { getMidiSession, type YamahaMidiSession } from "@/lib/yamaha"
import { getPreferredKeyboardModel } from "@/lib/yamaha/preferred-model"
import type { z } from "zod"
import type {
  CreativeDirection,
  DisplayNoteContext,
  LyricsAdapters,
  LyricsProject,
  LyricAssignment,
  SavedLyrics,
} from "./types"

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

type MelodyContext = {
  section: ProjectSection
  project: ProjectDocument
}

function pitchLabel(pitch: number): string {
  const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`
}

function displayNotes(section: ProjectSection): DisplayNoteContext[] {
  const melody = section.melody
  if (!melody) return []
  return melody.notes.map((note, index) => ({
    id: note.id,
    label: `Note ${index + 1}`,
    pitchLabel: pitchLabel(note.pitch),
    beatLabel: `Beat ${(note.startTick / melody.ppq + 1).toFixed(2).replace(/\.00$/, "")}`,
    durationLabel: `${(note.durationTicks / melody.ppq).toFixed(2).replace(/\.00$/, "")} beats`,
  }))
}

function savedLyrics(document: ProjectDocument, sectionId: string): SavedLyrics | undefined {
  const saved = document.lyrics
  if (
    saved?.sectionId !== sectionId ||
    !saved.creative ||
    !saved.assignments ||
    !saved.recipeReferenceId
  ) {
    return undefined
  }
  return {
    creative: saved.creative,
    assignments: saved.assignments,
    recipeReferenceId: saved.recipeReferenceId,
    renderReferenceId: saved.renderReferenceId ?? null,
    exportReferenceId: saved.exportReferenceId ?? null,
    savedLabel: "Lyrics saved for this section",
  }
}

function mapLyricsProject(session: ProjectSession): LyricsProject {
  const snapshot = session.getSnapshot()
  if (!snapshot.projectId || !snapshot.document || !snapshot.revisionId) {
    throw new ProjectClientError("validation", "No project document is open.")
  }
  return {
    id: snapshot.projectId,
    title: snapshot.document.song.title,
    tempo: snapshot.document.song.tempo,
    key: snapshot.document.song.key,
    sections: snapshot.document.song.sections.map((section) => ({
      id: section.id,
      name: section.name,
      bars: section.bars ?? 0,
      melodyLabel: section.melody?.label ?? "No imported melody",
      contextRevision: snapshot.revisionId!,
      notes: displayNotes(section),
    })),
    savedBySection: Object.fromEntries(
      snapshot.document.song.sections.map((section) => [
        section.id,
        savedLyrics(snapshot.document!, section.id),
      ]),
    ),
  }
}

function melodyContext(session: ProjectSession, projectId: string, sectionId: string): MelodyContext {
  const snapshot = session.getSnapshot()
  if (snapshot.projectId !== projectId || !snapshot.document) {
    throw new ProjectClientError("validation", "Open the project before using Lyrics.")
  }
  const section = snapshot.document.song.sections.find((item) => item.id === sectionId)
  if (!section?.melody?.notes.length) {
    throw new LyricsAdapterError("validation", "Import a melody for this section before using Lyrics.")
  }
  return { section, project: snapshot.document }
}

function sectionRole(name: string): "verse" | "pre" | "chorus" | "bridge" | "intro" | "outro" {
  const value = name.toLowerCase()
  if (value.includes("chorus")) return "chorus"
  if (value.includes("bridge")) return "bridge"
  if (value.includes("intro")) return "intro"
  if (value.includes("outro") || value.includes("ending")) return "outro"
  if (value.includes("pre")) return "pre"
  return "verse"
}

function chordContext(section: ProjectSection) {
  const chords = [...section.chords].sort((left, right) => left.startBeat - right.startBeat)
  const endBeat = (section.bars ?? 0) * 4
  return chords.map((chord, index) => ({
    symbol: chord.symbol,
    startBar: chord.startBeat / 4,
    durationBars:
      (chord.durationBeats ?? (chords[index + 1]?.startBeat ?? endBeat) - chord.startBeat) / 4,
  }))
}

function fitRequest(
  context: MelodyContext,
  projectId: string,
  contextRevision: string,
  lines: Array<{ phraseId: string; text: string }>,
) {
  const melody = context.section.melody!
  return {
    projectId,
    contextRevision,
    ppq: melody.ppq,
    tempoBpm: context.project.song.tempo,
    key: context.project.song.key,
    timeSignature: { numerator: 4 as const, denominator: 4 as const },
    chords: chordContext(context.section),
    notes: melody.notes.map((note) => ({
      noteId: note.id,
      pitch: note.pitch,
      startTick: note.startTick,
      durationTicks: note.durationTicks,
      phraseId: note.phraseId ?? context.section.id,
    })),
    lines,
  }
}

function assignmentsFromFit(response: LyricFitResponse): LyricAssignment[] {
  let index = 0
  return response.phrases.flatMap((phrase) =>
    phrase.assignments.map((assignment) => ({
      id: `${phrase.phraseId}-${++index}`,
      word: assignment.lyric,
      syllable: assignment.lyric,
      noteId: assignment.noteId,
    })))
}

function editedLines(context: MelodyContext, assignments: LyricAssignment[]) {
  const phraseByNote = new Map(
    context.section.melody!.notes.map((note) => [
      note.id,
      note.phraseId ?? context.section.id,
    ]),
  )
  const grouped = new Map<string, string[]>()
  for (const assignment of assignments) {
    const phraseId = phraseByNote.get(assignment.noteId) ?? context.section.id
    grouped.set(phraseId, [...(grouped.get(phraseId) ?? []), assignment.word])
  }
  return [...grouped].map(([phraseId, words]) => ({ phraseId, text: words.join(" ") }))
}

export function createProductionLyricsWorkspaceAdapters(options: {
  fetch?: FetchLike
  projects?: ProjectSession
  download?: Download
  midiSession?: YamahaMidiSession
  model?: KeyboardModel
} = {}): LyricsAdapters {
  const base = createProductionLyricsAdapters(options)
  const projects = base.projects
  const midiSession = options.midiSession ?? getMidiSession()
  const resolveModel = (): KeyboardModel =>
    options.model ??
    getPreferredKeyboardModel() ??
    midiSession.state.profile?.id ??
    "genos2"
  const player = new RhythmRenderedAuditionPlayer({ session: midiSession })
  const fits = new Map<string, LyricFitResponse>()

  async function open(projectId: string): Promise<LyricsProject> {
    await projects.open(projectId)
    return mapLyricsProject(projects)
  }

  async function fit(
    operation: "fit" | "remap",
    projectId: string,
    sectionId: string,
    contextRevision: string,
    lines: Array<{ phraseId: string; text: string }>,
  ) {
    const context = melodyContext(projects, projectId, sectionId)
    const request = fitRequest(context, projectId, contextRevision, lines)
    const response =
      operation === "fit" ? await base.lyrics.fit(request) : await base.lyrics.remap(request)
    fits.set(sectionId, response)
    return response
  }

  return {
    projects: {
      async list() {
        const summaries = await projects.list()
        const result: LyricsProject[] = []
        for (const summary of summaries) result.push(await open(summary.id))
        if (summaries[0]) await projects.open(summaries[0].id)
        return result
      },
      open,
      async save(request) {
        const snapshot = projects.getSnapshot()
        if (snapshot.projectId !== request.projectId) await projects.open(request.projectId)
        const current = projects.getSnapshot()
        if (!current.document || current.revisionId !== request.contextRevision) {
          throw new ProjectClientError("validation", "Project context changed. Reopen and try again.")
        }
        projects.updateDocument({
          ...current.document,
          lyrics: {
            text: request.assignments.map((item) => item.word).join(" "),
            syllables: request.assignments.map((item, noteIndex) => ({
              text: item.syllable,
              noteIndex,
            })),
            recipeReferenceId: request.recipeReferenceId,
            ...(request.renderReferenceId
              ? { renderReferenceId: request.renderReferenceId }
              : {}),
            ...(request.exportReferenceId
              ? { exportReferenceId: request.exportReferenceId }
              : {}),
            sectionId: request.sectionId,
            creative: request.creative,
            assignments: request.assignments,
          },
        })
        const saved = await projects.save()
        if (!saved) {
          const next = projects.getSnapshot()
          throw new ProjectClientError(
            next.conflict ? "conflict" : "internal",
            next.conflict?.message ?? next.lastError ?? "Lyrics could not be saved.",
          )
        }
        return mapLyricsProject(projects)
      },
    },
    lyrics: {
      async generate(request) {
        const context = melodyContext(projects, request.projectId, request.sectionId)
        const phraseCounts = new Map<string, number>()
        for (const note of context.section.melody!.notes) {
          const phraseId = note.phraseId ?? context.section.id
          phraseCounts.set(phraseId, (phraseCounts.get(phraseId) ?? 0) + 1)
        }
        const generated = await base.lyrics.generate({
          projectId: request.projectId,
          creative: {
            title: request.creative.title,
            subject: request.creative.about,
            theme: request.creative.theme,
            mood: request.creative.mood,
            avoidWords: request.creative.avoidWords
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            language: "en",
          },
          prosody: {
            phrases: [...phraseCounts].map(([phraseId, syllables]) => ({
              phraseId,
              sectionRole: sectionRole(context.section.name),
              syllables,
              prominence: [],
              sustain: [],
            })),
          },
        })
        const fitted = await fit(
          "fit",
          request.projectId,
          request.sectionId,
          request.contextRevision,
          generated.lines,
        )
        return {
          assignments: assignmentsFromFit(fitted),
          recipeReferenceId: fitted.recipeReferenceId,
          statusLabel: `Lyrics generated for ${request.notes.length} melody notes`,
        }
      },
      async refit(request) {
        const context = melodyContext(projects, request.projectId, request.sectionId)
        const fitted = await fit(
          "remap",
          request.projectId,
          request.sectionId,
          request.contextRevision,
          editedLines(context, request.assignments),
        )
        return {
          assignments: assignmentsFromFit(fitted),
          recipeReferenceId: fitted.recipeReferenceId,
          statusLabel: "Edited lyrics re-fitted to the melody",
        }
      },
      async audition(input) {
        const context = melodyContext(projects, input.projectId, input.sectionId)
        const fitted = await fit(
          "remap",
          input.projectId,
          input.sectionId,
          input.contextRevision,
          editedLines(context, input.assignments),
        )
        if (!midiSession.state.connected) {
          const connected = await midiSession.requestAccess(resolveModel())
          if (!connected.connected) {
            throw new LyricsAdapterError(
              "unavailable",
              connected.error || "Connect the Yamaha keyboard before auditioning.",
            )
          }
        }
        player.start({
          part: "solo",
          durationMs: Math.max(1, (context.section.bars ?? 1) * 4 * 60_000 /
            context.project.song.tempo),
          renderedSmf: fitted.renderedExport,
          playback: {
            channel: 1,
            kind: "channel-current",
            label: "Lyrics melody",
            bankMsb: null,
            bankLsb: null,
            programYamaha: null,
          },
        })
        return {
          renderReferenceId: fitted.renderReferenceId,
          statusLabel: "Audition playing on the connected keyboard",
        }
      },
      async export(input) {
        const fit = fits.get(input.sectionId)
        if (!fit || fit.recipeReferenceId !== input.recipeReferenceId) {
          throw new LyricsAdapterError("validation", "Prepare the current lyrics before export.")
        }
        base.lyrics.export(fit)
        return {
          exportReferenceId: fit.renderReferenceId,
          statusLabel: "Export downloaded",
        }
      },
    },
  }
}
