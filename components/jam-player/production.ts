"use client"

import { createJamCatalogClient, type JamCatalogClient as DomainCatalogClient } from "@/lib/jam/catalog"
import {
  parseJamPrepareResponse,
  parseJamReharmonizeResponse,
  type JamPrepareRequest as DomainPrepareRequest,
  type JamReharmonizeRequest as DomainReharmonizeRequest,
} from "@/lib/jam/domain"
import {
  PlanDispatcher as DomainPlanDispatcher,
  type DispatchPlaybackState as DomainPlaybackState,
  type PreparedPerformancePlan,
} from "@/lib/jam/dispatch"
import {
  createProjectSession,
  type ProjectSession,
  type ProjectSaveState,
} from "@/lib/projects/client"
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type ProjectChord,
  type ProjectDocument,
  type ProjectStylePart,
} from "@/lib/projects/document"
import { getMidiSession, type YamahaMidiSession } from "@/lib/yamaha"
import type {
  DispatchPlaybackState,
  DisplayChord,
  JamCatalogClient,
  JamConnectionClient,
  JamConnectionState,
  JamEngineClient,
  JamEngineErrorCode,
  JamPlayerAdapters,
  JamPrepareRequest,
  JamProjectRecord,
  JamProjectSaveState,
  JamProjectSession,
  JamReharmonizeRequest,
  JamReharmonizeResponse,
  JamSong,
  JamSongSummary,
  JamStyleSummary,
  MainVariation,
  PlanDispatcher,
} from "./types"
import { JamEngineError } from "./types"

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const PAGE_SIZE = 100
const ACCENTS = ["#38bdf8", "#c084fc", "#fbbf24", "#34d399", "#fb7185"]

function accentFor(id: string): string {
  let hash = 0
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return ACCENTS[hash % ACCENTS.length]!
}

function mapSong(song: Awaited<ReturnType<DomainCatalogClient["getSong"]>>): JamSong {
  const beatsPerBar = song.timeSignature[0]
  return {
    id: song.stableId,
    title: song.title,
    subtitle: song.description ?? `${song.category || "Factory"} factory arrangement`,
    category: song.category || "Uncategorized",
    tempo: song.tempo || 120,
    key: song.key || "C",
    timeSignature: song.timeSignature,
    accent: accentFor(song.stableId),
    sections: [...song.sections]
      .sort((left, right) => left.order - right.order)
      .map((section) => ({
        id: section.stableId,
        label: section.name,
        bars: section.bars,
        variation: section.main,
        chords: section.chords.map((chord) => ({
          beat: chord.startBar * beatsPerBar + chord.startBeat,
          duration: chord.lengthBeats,
          name: chord.symbol,
        })),
      })),
  }
}

async function collectPages<T>(
  load: (page: number) => Promise<{ items: T[]; hasMore: boolean }>,
): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page += 1) {
    const result = await load(page)
    items.push(...result.items)
    if (!result.hasMore) return items
  }
}

export function createProductionCatalogAdapter(
  client: DomainCatalogClient = createJamCatalogClient(),
): JamCatalogClient {
  return {
    async listCategories() {
      const snapshot = await client.ensureLoaded()
      return [...new Set(snapshot.songs.map((song) => song.category || "Uncategorized"))].sort()
    },
    async listSongs(options = {}) {
      const songs = await collectPages((page) =>
        client.listSongs({ ...options, page, pageSize: PAGE_SIZE }),
      )
      return songs.map(
        (song): JamSongSummary => ({
          id: song.stableId,
          title: song.title,
          category: song.category || "Uncategorized",
          tempo: song.tempo || 120,
          key: song.key || "C",
          sectionCount: song.sections.length,
          accent: accentFor(song.stableId),
        }),
      )
    },
    async getSong(songId) {
      return mapSong(await client.getSong(songId))
    },
    async listStyles(options) {
      const styles = await collectPages((page) =>
        client.listStyles(options.model, {
          category: options.category,
          search: options.search,
          page,
          pageSize: PAGE_SIZE,
        }),
      )
      return styles.map(
        (style): JamStyleSummary => ({
          id: style.stableId,
          name: style.name,
          category: style.category || "Other",
          styleNumber: style.styleNumber,
          bpm: style.bpm || 0,
        }),
      )
    },
  }
}

function safeMessage(body: unknown, fallback: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    typeof (body as Record<string, unknown>).error === "string"
  ) {
    return (body as { error: string }).error
  }
  return fallback
}

function mapEngineError(status: number, body: unknown): JamEngineError {
  const serverCode =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).code
      : undefined
  let code: JamEngineErrorCode = "unavailable"
  if (status === 401 || serverCode === "unauthenticated") code = "unauthorized"
  else if (status === 429 || serverCode === "quota_exceeded") code = "quota_exceeded"
  else if (status === 400 || status === 413 || serverCode === "validation") code = "validation"
  return new JamEngineError(code, safeMessage(body, "The Jam service is temporarily unavailable."))
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new JamEngineError("unavailable", "The Jam service returned an invalid response.")
  }
}

function toDomainChords(song: JamSong): Array<{ symbol: string; startBar: number; durationBars: number }> {
  const beatsPerBar = song.timeSignature[0]
  let sectionStartBar = 0
  const chords: Array<{ symbol: string; startBar: number; durationBars: number }> = []
  for (const section of song.sections) {
    for (const chord of section.chords) {
      chords.push({
        symbol: chord.name,
        startBar: sectionStartBar + Math.floor(chord.beat / beatsPerBar),
        durationBars: chord.duration / beatsPerBar,
      })
    }
    sectionStartBar += section.bars
  }
  return chords
}

function toDomainPrepare(request: JamPrepareRequest): DomainPrepareRequest {
  const beatsPerBar = request.song.timeSignature[0]
  return {
    projectId: request.projectId,
    model: request.model,
    song: {
      tempoBpm: request.tempo,
      key: request.key,
      timeSignature: {
        numerator: request.song.timeSignature[0],
        denominator: request.song.timeSignature[1] as 1 | 2 | 4 | 8 | 16,
      },
      sections: request.song.sections.map((section) => ({
        id: section.id,
        name: section.label,
        barCount: section.bars,
        styleNumber: request.styleNumber,
        chords: section.chords.map((chord) => ({
          symbol: chord.name,
          startBar: Math.floor(chord.beat / beatsPerBar),
          durationBars: chord.duration / beatsPerBar,
        })),
      })),
    },
  }
}

function toDomainReharmonize(request: JamReharmonizeRequest): DomainReharmonizeRequest {
  return {
    projectId: request.projectId,
    model: request.model,
    scope: request.scope,
    ...(request.sectionId ? { sectionId: request.sectionId } : {}),
    key: request.key,
    chords: toDomainChords(request.song),
  }
}

function mapReharmonize(
  request: JamReharmonizeRequest,
  response: ReturnType<typeof parseJamReharmonizeResponse>,
): JamReharmonizeResponse {
  const beatsPerBar = request.song.timeSignature[0]
  const starts = new Map<string, number>()
  let cursor = 0
  for (const section of request.song.sections) {
    starts.set(section.id, cursor)
    cursor += section.bars
  }
  return {
    generationId: response.generationId,
    candidates: response.candidates.map((candidate, index) => {
      const chordsBySection: Record<string, DisplayChord[]> = {}
      for (const section of request.song.sections) {
        if (request.scope === "section" && section.id !== request.sectionId) continue
        const start = request.scope === "section" ? 0 : (starts.get(section.id) ?? 0)
        const end = start + section.bars
        chordsBySection[section.id] = candidate.chords
          .filter((chord) => chord.startBar >= start && chord.startBar < end)
          .map((chord) => ({
            beat: (chord.startBar - start) * beatsPerBar,
            duration: chord.durationBars * beatsPerBar,
            name: chord.symbol,
          }))
      }
      return {
        id: candidate.id,
        label: candidate.label ?? `Candidate ${index + 1}`,
        chordsBySection,
      }
    }),
  }
}

export function createProductionEngineClient(fetchImpl: FetchLike = fetch): JamEngineClient {
  async function post(path: string, body: unknown): Promise<unknown> {
    let response: Response
    try {
      response = await fetchImpl(path, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    } catch {
      throw new JamEngineError("network", "Could not reach the Jam service.")
    }
    const parsed = await readJson(response)
    if (!response.ok) throw mapEngineError(response.status, parsed)
    return parsed
  }
  return {
    async prepare(request) {
      return parseJamPrepareResponse(
        await post("/api/engine/jam/prepare", toDomainPrepare(request)),
      )
    },
    async reharmonize(request) {
      const parsed = parseJamReharmonizeResponse(
        await post("/api/engine/jam/reharmonize", toDomainReharmonize(request)),
      )
      return mapReharmonize(request, parsed)
    },
  }
}

function connectionState(session: YamahaMidiSession): JamConnectionState {
  const state = session.state
  const guidance = !state.supported
    ? "Web MIDI is not available. Use Chrome or Edge on desktop."
    : !state.secure
      ? "Keyboard access requires HTTPS or localhost."
      : state.error ||
        (state.connected
          ? "Keyboard is connected and ready."
          : "Connect both Yamaha USB-MIDI ports, then refresh.")
  return {
    browserSupported: state.supported,
    secure: state.secure,
    connected: state.connected && state.profile !== null,
    model: state.profile?.id ?? null,
    displayName: state.modelName || state.outputName || null,
    guidance,
  }
}

export function createYamahaConnectionAdapter(session: YamahaMidiSession): JamConnectionClient {
  return {
    getState: () => connectionState(session),
    async refresh() {
      await session.requestAccess()
    },
    subscribe(listener) {
      const handle = () => listener(connectionState(session))
      session.addEventListener("statechange", handle)
      listener(connectionState(session))
      return () => session.removeEventListener("statechange", handle)
    },
  }
}

export function displayAt(
  plan: PreparedPerformancePlan | null,
  state: DomainPlaybackState,
): { chord: string; section: string } {
  if (!plan || !state.selection) return { chord: "", section: "" }
  const selection = state.selection
  const beatMs =
    (60_000 / plan.display.tempoBpm) *
    (4 / plan.display.timeSignature.denominator)
  const barMs = beatMs * plan.display.timeSignature.numerator
  const section =
    selection.mode === "section"
      ? plan.display.sections.find((item) => item.id === selection.sectionId)
      : [...plan.display.sections]
          .reverse()
          .find((item) => item.startBar * barMs <= state.positionMs)
  if (!section) return { chord: "", section: "" }
  const absoluteBar =
    selection.mode === "section"
      ? section.startBar + state.positionMs / barMs
      : state.positionMs / barMs
  const chord = [...plan.display.chords]
    .reverse()
    .find((item) => item.startBar <= absoluteBar)
  return { chord: chord?.symbol ?? "", section: section.name }
}

export function createProductionPlanDispatcher(
  session: YamahaMidiSession,
): PlanDispatcher {
  const listeners = new Set<(state: DispatchPlaybackState) => void>()
  let plan: PreparedPerformancePlan | null = null
  let state: DispatchPlaybackState = {
    status: "idle",
    planId: null,
    selection: null,
    positionMs: 0,
    durationMs: 0,
    currentChord: "",
    currentSectionLabel: "",
    error: null,
  }
  const domain = new DomainPlanDispatcher({
    session,
    onStateChange(next) {
      const display = displayAt(plan, next)
      state = {
        status: next.status,
        planId: next.planId,
        selection: next.selection,
        positionMs: next.positionMs,
        durationMs: next.durationMs,
        currentChord: display.chord,
        currentSectionLabel: display.section,
        error: next.error,
      }
      for (const listener of listeners) listener({ ...state })
    },
  })
  return {
    loadPlan(next) {
      domain.load(next)
      plan = next
      const current = domain.playbackState
      state = { ...state, status: current.status, planId: current.planId, durationMs: current.durationMs }
      for (const listener of listeners) listener({ ...state })
    },
    play(selection) {
      domain.start(selection)
    },
    stop() {
      domain.stop()
    },
    panic() {
      domain.panic()
    },
    getState: () => ({ ...state }),
    subscribe(listener) {
      listeners.add(listener)
      listener({ ...state })
      return () => listeners.delete(listener)
    },
  }
}

const VARIATION_TO_PART: Record<MainVariation, ProjectStylePart> = {
  A: "mainA",
  B: "mainB",
  C: "mainC",
  D: "mainD",
}
const PART_TO_VARIATION: Partial<Record<ProjectStylePart, MainVariation>> = {
  mainA: "A",
  mainB: "B",
  mainC: "C",
  mainD: "D",
}

function projectChord(chord: DisplayChord): ProjectChord {
  return { symbol: chord.name, startBeat: chord.beat, durationBeats: chord.duration }
}

function documentFromRecord(record: Omit<JamProjectRecord, "updatedAt">): ProjectDocument {
  const song = record.song
  return {
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    song: {
      title: record.title,
      tempo: record.tempo,
      key: record.key,
      style: { id: record.styleId },
      sections:
        song?.sections.map((section) => ({
          id: section.id,
          name: section.label,
          stylePart: VARIATION_TO_PART[section.variation],
          bars: section.bars,
          chords: section.chords.map(projectChord),
        })) ?? [],
    },
    jam: {
      factorySongStableId: record.songId,
      styleStableId: record.styleId,
      model: record.model,
      loop: record.loop,
      ...(record.generationId ? { generationId: record.generationId } : {}),
      ...(record.candidateId ? { candidateId: record.candidateId } : {}),
      ...(record.chordsBySection
        ? {
            selectedChordsBySection: Object.fromEntries(
              Object.entries(record.chordsBySection).map(([id, chords]) => [
                id,
                chords.map(projectChord),
              ]),
            ),
          }
        : {}),
    },
  }
}

function mapSaveState(state: ProjectSaveState): JamProjectSaveState {
  if (state === "scheduled") return "dirty"
  if (state === "conflict") return "error"
  return state
}

function recordFromSession(session: ProjectSession): JamProjectRecord {
  const snapshot = session.getSnapshot()
  const document = snapshot.document
  const jam = document?.jam
  const selected = jam?.selectedChordsBySection
    ? Object.fromEntries(
        Object.entries(jam.selectedChordsBySection).map(([id, chords]) => [
          id,
          chords.map((chord) => ({
            beat: chord.startBeat,
            duration: chord.durationBeats ?? 1,
            name: chord.symbol,
          })),
        ]),
      )
    : null
  return {
    id: snapshot.projectId ?? "",
    title: snapshot.title,
    version: snapshot.version ?? 1,
    updatedAt: new Date().toISOString(),
    songId: jam?.factorySongStableId ?? "",
    key: document?.song.key ?? "C",
    tempo: document?.song.tempo ?? 120,
    styleId: jam?.styleStableId ?? document?.song.style?.id ?? "",
    model: jam?.model ?? "genos",
    loop: jam?.loop ?? false,
    generationId: jam?.generationId ?? null,
    candidateId: jam?.candidateId ?? null,
    chordsBySection: selected,
    song: null,
  }
}

export function createJamProjectAdapter(session: ProjectSession): JamProjectSession {
  let draftDirty = false
  const listeners = new Set<() => void>()
  const emit = () => {
    for (const listener of listeners) listener()
  }
  session.subscribe(emit)
  return {
    async list() {
      const projects = await session.list()
      return projects.map((project) => ({
        id: project.id,
        title: project.title,
        version: project.currentVersion ?? 1,
        updatedAt: project.updatedAt,
        songId: "",
        key: "C",
        tempo: 120,
        styleId: "",
        model: "genos",
        loop: false,
        generationId: null,
        candidateId: null,
        chordsBySection: null,
        song: null,
      }))
    },
    async create(title) {
      await session.create({ title })
      draftDirty = false
      return recordFromSession(session)
    },
    async open(projectId) {
      await session.open(projectId)
      draftDirty = false
      return recordFromSession(session)
    },
    async save(patch) {
      session.updateTitle(patch.title)
      session.updateDocument(documentFromRecord(patch))
      await session.save()
      draftDirty = session.getSnapshot().dirty
      return recordFromSession(session)
    },
    getSaveState: () =>
      draftDirty ? "dirty" : mapSaveState(session.getSnapshot().saveState),
    getLastError: () => session.getSnapshot().lastError,
    markDirty() {
      draftDirty = true
      emit()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function createProductionJamAdapters(options?: {
  catalog?: DomainCatalogClient
  session?: YamahaMidiSession
  projects?: ProjectSession
  fetch?: FetchLike
}): JamPlayerAdapters {
  const session = options?.session ?? getMidiSession()
  return {
    catalog: createProductionCatalogAdapter(options?.catalog),
    engine: createProductionEngineClient(options?.fetch),
    connection: createYamahaConnectionAdapter(session),
    dispatcher: createProductionPlanDispatcher(session),
    projects: createJamProjectAdapter(options?.projects ?? createProjectSession()),
  }
}
