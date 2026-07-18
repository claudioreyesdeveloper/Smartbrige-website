"use client"

import { MixerEngine } from "@/lib/mixer/engine"
import { ProductionMixerSession } from "@/lib/mixer/session"
import type {
  MixerChannelState as EngineChannel,
  MixerParameter,
  MixerSnapshot,
  MixerVoice as EngineVoice,
} from "@/lib/mixer/types"
import {
  createProjectSession,
  ProjectClientError,
  type ProjectSession,
  type ProjectSessionSnapshot,
} from "@/lib/projects/client"
import type { ProjectDocument, ProjectMixerChannel } from "@/lib/projects/document"
import { getMidiSession, type YamahaMidiSession } from "@/lib/yamaha"
import type { YamahaModelId } from "@/lib/yamaha/types"
import { createUnknownMixerChannels } from "./state"
import type {
  GenosMixerAdapters,
  MixerChannel,
  MixerChannelChange,
  MixerConnectionState,
  MixerProject,
  MixerVoice,
} from "./types"
import { toProjectMixerChannel } from "./types"

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const VERIFIED_MIXER_MODELS = new Set<YamahaModelId>(["genos", "genos2", "tyros5"])

function voiceId(voice: EngineVoice): string {
  return `midi:${voice.msb}:${voice.lsb}:${voice.program}`
}

function parseVoiceId(id: string): EngineVoice | null {
  const match = /^midi:(\d{1,3}):(\d{1,3}):(\d{1,3})$/.exec(id)
  if (!match) return null
  const voice = {
    msb: Number(match[1]),
    lsb: Number(match[2]),
    program: Number(match[3]),
  }
  return voice.msb <= 127 && voice.lsb <= 127 && voice.program >= 1 && voice.program <= 128
    ? voice
    : null
}

function displayVoice(voice: EngineVoice): MixerVoice {
  return {
    id: voiceId(voice),
    name: `Bank ${voice.msb}/${voice.lsb} · Program ${voice.program}`,
    category: "Detected keyboard voice",
    ...voice,
  }
}

function channelFromEngine(channel: EngineChannel): MixerChannel {
  const voice = channel.voice ? displayVoice(channel.voice) : null
  return {
    part: channel.channel,
    label: channel.label,
    voiceId: voice?.id ?? "",
    voiceName: voice?.name ?? "Unknown",
    volume: channel.volume ?? 100,
    pan: channel.pan ?? 64,
    reverb: channel.reverb ?? 0,
    chorus: channel.chorus ?? 0,
    mute: channel.muted,
    known: channel.known,
  }
}

function mergeStoredChannels(stored: readonly ProjectMixerChannel[] | undefined): MixerChannel[] {
  const byPart = new Map(stored?.map((channel) => [channel.part, channel]) ?? [])
  return createUnknownMixerChannels().map((channel) => {
    const saved = byPart.get(channel.part)
    if (!saved) return channel
    const voice = saved.voiceId ? parseVoiceId(saved.voiceId) : null
    return {
      ...channel,
      volume: saved.volume ?? channel.volume,
      pan: saved.pan ?? channel.pan,
      reverb: saved.reverb ?? channel.reverb,
      chorus: saved.chorus ?? channel.chorus,
      mute: saved.mute ?? channel.mute,
      voiceId: voice ? voiceId(voice) : "",
      voiceName: voice ? displayVoice(voice).name : "Unknown",
      known: true,
    }
  })
}

function projectFromSnapshot(snapshot: ProjectSessionSnapshot): MixerProject {
  if (!snapshot.projectId || !snapshot.document) {
    throw new ProjectClientError("validation", "No project document is open.")
  }
  return {
    id: snapshot.projectId,
    title: snapshot.document.song.title,
    document: structuredClone(snapshot.document),
    channels: mergeStoredChannels(snapshot.document.mixer?.channels),
  }
}

async function openProject(session: ProjectSession, projectId: string): Promise<MixerProject> {
  await session.open(projectId)
  const snapshot = session.getSnapshot()
  if (snapshot.projectId !== projectId) {
    throw new ProjectClientError("validation", "Project could not be opened.")
  }
  return projectFromSnapshot(snapshot)
}

export function createMixerProjectAdapter(session: ProjectSession) {
  return {
    async list() {
      const summaries = (await session.list()).slice(0, 50)
      const projects: MixerProject[] = []
      for (const summary of summaries) projects.push(await openProject(session, summary.id))
      if (summaries[0]) await session.open(summaries[0].id)
      return projects
    },
    open(projectId: string) {
      return openProject(session, projectId)
    },
    async save(projectId: string, channels: readonly MixerChannel[]) {
      if (session.getSnapshot().projectId !== projectId) await session.open(projectId)
      const snapshot = session.getSnapshot()
      if (!snapshot.document) {
        throw new ProjectClientError("validation", "Project could not be saved.")
      }
      const document: ProjectDocument = {
        ...snapshot.document,
        mixer: { channels: channels.map(toProjectMixerChannel) },
      }
      session.updateDocument(document)
      const saved = await session.save()
      const next = session.getSnapshot()
      if (!saved && next.conflict) {
        throw new ProjectClientError("conflict", next.conflict.message)
      }
      if (!saved) {
        throw new ProjectClientError(
          "internal",
          next.lastError ?? "Mixer could not be saved.",
        )
      }
      return projectFromSnapshot(next)
    },
  }
}

class ProductionMixerDevice {
  private production: ProductionMixerSession | null = null
  private engine: MixerEngine | null = null
  private model: YamahaModelId | null = null
  private state: MixerConnectionState
  private readonly listeners = new Set<(state: MixerConnectionState) => void>()

  private readonly onSessionState = () => {
    this.syncEngine()
    this.publish(this.connectionState())
  }

  private readonly onEngineState = (event: Event) => {
    const snapshot = (event as CustomEvent<MixerSnapshot>).detail
    this.publish(this.connectionState(snapshot))
  }

  constructor(private readonly session: YamahaMidiSession) {
    this.state = this.connectionState()
    session.addEventListener("statechange", this.onSessionState)
    this.syncEngine()
  }

  getState(): MixerConnectionState {
    return { ...this.state }
  }

  subscribe(listener: (state: MixerConnectionState) => void): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => this.listeners.delete(listener)
  }

  async refresh(): Promise<readonly MixerChannel[]> {
    if (!this.session.state.connected) await this.session.requestAccess()
    this.syncEngine()
    const engine = this.requireEngine()
    engine.refresh()
    const snapshot = await this.waitForRefresh(engine)
    return snapshot.channels.map(channelFromEngine)
  }

  updateChannel(channel: MixerChannel, change: MixerChannelChange): void {
    const engine = this.requireEngine()
    if (change === "voice") {
      const voice = parseVoiceId(channel.voiceId)
      if (!voice) throw new Error("Select a voice detected from the connected keyboard.")
      engine.setVoice(channel.part, voice)
    } else if (change === "mute") {
      engine.setMute(channel.part, channel.mute)
    } else {
      engine.setParameter(channel.part, change, channel[change])
    }
  }

  searchVoices(query: string): readonly MixerVoice[] {
    if (!this.engine) return []
    const normalized = query.trim().toLowerCase()
    const unique = new Map<string, MixerVoice>()
    for (const channel of this.engine.state.channels) {
      if (!channel.voice) continue
      const voice = displayVoice(channel.voice)
      if (
        !normalized ||
        voice.name.toLowerCase().includes(normalized) ||
        voice.category.toLowerCase().includes(normalized)
      ) {
        unique.set(voice.id, voice)
      }
    }
    return [...unique.values()]
  }

  dispose(): void {
    this.session.removeEventListener("statechange", this.onSessionState)
    this.detachEngine()
    this.listeners.clear()
  }

  private syncEngine(): void {
    const profile = this.session.state.profile
    const nextModel =
      profile && VERIFIED_MIXER_MODELS.has(profile.id) ? profile.id : null
    if (nextModel === this.model && this.engine) {
      this.engine.setConnected(this.session.state.connected)
      return
    }
    this.detachEngine()
    if (!nextModel) return
    this.production = new ProductionMixerSession(this.session, nextModel)
    this.engine = this.production.engine
    this.model = nextModel
    this.engine.addEventListener("statechange", this.onEngineState)
  }

  private detachEngine(): void {
    this.engine?.removeEventListener("statechange", this.onEngineState)
    this.production?.dispose()
    this.production = null
    this.engine = null
    this.model = null
  }

  private requireEngine(): MixerEngine {
    if (this.session.state.profile?.id === "tyros4") {
      throw new Error("Tyros4 mixer behavior is not verified.")
    }
    if (!this.engine) {
      throw new Error("Connect a verified Yamaha keyboard before using the mixer.")
    }
    return this.engine
  }

  private connectionState(snapshot = this.engine?.state): MixerConnectionState {
    const session = this.session.state
    const model = this.model
      ? session.profile?.displayName ?? session.modelName
      : null
    if (session.error) {
      return { phase: "error", model, progress: 0, message: session.error }
    }
    if (session.profile?.id === "tyros4") {
      return {
        phase: "error",
        model: session.profile.displayName,
        progress: 0,
        message: "Tyros4 mixer behavior is not verified.",
      }
    }
    if (!session.connected || !snapshot) {
      return {
        phase: "unknown",
        model,
        progress: 0,
        message: session.connecting ? "Connecting…" : "Connect keyboard, then refresh",
      }
    }
    const style = snapshot.refresh.style
    const song = snapshot.refresh.song
    if (style.status === "loading" || song.status === "loading") {
      const replied = style.replied + song.replied
      const requested = style.requested + song.requested
      return {
        phase: "refreshing",
        model,
        progress: requested ? replied / requested : 0,
        message: song.status === "loading" ? "Reading Song channels…" : "Reading Style channels…",
      }
    }
    return { phase: "connected", model, progress: 1, message: "Connected" }
  }

  private publish(next: MixerConnectionState): void {
    this.state = next
    for (const listener of this.listeners) listener({ ...next })
  }

  private waitForRefresh(engine: MixerEngine): Promise<MixerSnapshot> {
    return new Promise((resolve, reject) => {
      const finish = (snapshot: MixerSnapshot) => {
        const statuses = [snapshot.refresh.style.status, snapshot.refresh.song.status]
        if (statuses.includes("loading") || statuses.includes("idle")) return
        engine.removeEventListener("statechange", onState)
        if (statuses.includes("disconnected")) {
          reject(new Error("Keyboard disconnected during mixer refresh."))
        } else if (statuses.includes("timed-out")) {
          reject(new Error("Mixer refresh timed out before all keyboard replies arrived."))
        } else {
          resolve(snapshot)
        }
      }
      const onState = (event: Event) => {
        finish((event as CustomEvent<MixerSnapshot>).detail)
      }
      engine.addEventListener("statechange", onState)
      finish(engine.state)
    })
  }
}

export function createProductionGenosMixerAdapters(options: {
  fetch?: FetchLike
  projects?: ProjectSession
  midiSession?: YamahaMidiSession
} = {}): GenosMixerAdapters {
  const session = options.midiSession ?? getMidiSession()
  const device = new ProductionMixerDevice(session)
  const projectSession = options.projects ?? createProjectSession({ fetch: options.fetch })
  return {
    device,
    projects: createMixerProjectAdapter(projectSession),
    voices: {
      async search(query) {
        return device.searchVoices(query)
      },
    },
    dispose() {
      device.dispose()
      if (!options.projects) projectSession.dispose()
    },
  }
}
