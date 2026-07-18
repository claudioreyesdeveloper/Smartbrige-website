import type { ProjectDocument, ProjectMixerChannel } from "@/lib/projects/document"
import { createUnknownMixerChannels } from "./state"
import type {
  GenosMixerAdapters,
  MixerChannel,
  MixerConnectionState,
  MixerProject,
  MixerVoice,
} from "./types"
import { toProjectMixerChannel } from "./types"

const VOICES: readonly MixerVoice[] = [
  { id: "genos-cfx-grand", name: "CFX Concert Grand", category: "Piano" },
  { id: "genos-live-strings", name: "Live! Strings", category: "Strings" },
  { id: "genos-s-art-sax", name: "S.Art! Tenor Sax", category: "Woodwind" },
  { id: "genos-vintage-organ", name: "Vintage Organ", category: "Organ" },
  { id: "genos-finger-bass", name: "MegaVoice Finger Bass", category: "Bass" },
  { id: "genos-studio-drums", name: "Studio Kit", category: "Drums" },
  { id: "genos-warm-pad", name: "Warm Pad", category: "Synth Pad" },
  { id: "genos-nylon-guitar", name: "S.Art! Nylon Guitar", category: "Guitar" },
]

const INITIAL_VOICES = [
  VOICES[0], VOICES[1], VOICES[2], VOICES[3],
  VOICES[7], VOICES[7], VOICES[6], null,
  VOICES[5], VOICES[5], VOICES[4], VOICES[7],
  VOICES[3], VOICES[6], VOICES[1], VOICES[2],
]

function fixtureChannels(): MixerChannel[] {
  return createUnknownMixerChannels().map((channel, index) => {
    const voice = index < 16 ? INITIAL_VOICES[index] : VOICES[index % VOICES.length]
    return {
      ...channel,
      voiceId: voice?.id ?? "",
      voiceName: voice?.name ?? "Unknown",
      volume: index % 4 === 0 ? 104 : 96 - (index % 5) * 4,
      pan: 64 + ((index % 5) - 2) * 8,
      reverb: 22 + (index % 4) * 7,
      chorus: 8 + (index % 3) * 6,
      known: voice !== null,
    }
  })
}

function createDocument(channels: readonly MixerChannel[]): ProjectDocument {
  return {
    schemaVersion: 1,
    song: {
      title: "Coastal Drive",
      tempo: 112,
      key: "C",
      sections: [],
    },
    mixer: { channels: channels.map(toProjectMixerChannel) },
  }
}

function applyStoredMixer(
  base: readonly MixerChannel[],
  stored: readonly ProjectMixerChannel[] | undefined,
): MixerChannel[] {
  const byPart = new Map(stored?.map((channel) => [channel.part, channel]) ?? [])
  return base.map((channel) => {
    const saved = byPart.get(channel.part)
    if (!saved) return { ...channel }
    const voice = VOICES.find((item) => item.id === saved.voiceId)
    return {
      ...channel,
      volume: saved.volume ?? channel.volume,
      pan: saved.pan ?? channel.pan,
      reverb: saved.reverb ?? channel.reverb,
      chorus: saved.chorus ?? channel.chorus,
      mute: saved.mute ?? channel.mute,
      voiceId: saved.voiceId ?? channel.voiceId,
      voiceName: voice?.name ?? channel.voiceName,
      known: true,
    }
  })
}

export type DisplaySafeMixerFakeOptions = {
  refreshError?: string
  refreshDelayMs?: number
}

/**
 * Deterministic UI fixture. It never opens Web MIDI, constructs Yamaha bytes,
 * or discovers hardware. Callers must inject it explicitly.
 */
export function createDisplaySafeMixerFakes(
  options: DisplaySafeMixerFakeOptions = {},
): GenosMixerAdapters {
  const wait = () =>
    new Promise<void>((resolve) => setTimeout(resolve, options.refreshDelayMs ?? 24))
  let channels = fixtureChannels()
  let project: MixerProject = {
    id: "project-coastal-drive",
    title: "Coastal Drive",
    document: createDocument(channels),
    channels: channels.map((channel) => ({ ...channel })),
  }
  let connection: MixerConnectionState = {
    phase: "connected",
    model: "Genos2",
    progress: 1,
    message: "Connected",
  }
  const listeners = new Set<(state: MixerConnectionState) => void>()
  const publish = (next: MixerConnectionState) => {
    connection = next
    listeners.forEach((listener) => listener({ ...connection }))
  }

  return {
    device: {
      getState: () => ({ ...connection }),
      subscribe(listener) {
        listeners.add(listener)
        listener({ ...connection })
        return () => listeners.delete(listener)
      },
      async refresh() {
        for (const progress of [0.15, 0.48, 0.76, 1]) {
          publish({
            phase: "refreshing",
            model: "Genos2",
            progress,
            message: progress < 0.5 ? "Reading Style voices…" : "Reading Song voices…",
          })
          await wait()
        }
        if (options.refreshError) {
          publish({
            phase: "error",
            model: "Genos2",
            progress: 0,
            message: options.refreshError,
          })
          throw new Error(options.refreshError)
        }
        publish({ phase: "connected", model: "Genos2", progress: 1, message: "Mixer refreshed" })
        return channels.map((channel) => ({ ...channel }))
      },
      updateChannel(channel) {
        channels = channels.map((item) => item.part === channel.part ? { ...channel } : item)
      },
    },
    projects: {
      async list() {
        await wait()
        return [structuredClone(project)]
      },
      async open(projectId) {
        await wait()
        if (projectId !== project.id) throw new Error("Project could not be opened.")
        channels = applyStoredMixer(fixtureChannels(), project.document.mixer?.channels)
        return structuredClone({ ...project, channels })
      },
      async save(projectId, nextChannels) {
        await wait()
        if (projectId !== project.id) throw new Error("Project could not be saved.")
        channels = nextChannels.map((channel) => ({ ...channel }))
        project = {
          ...project,
          channels: channels.map((channel) => ({ ...channel })),
          document: {
            ...project.document,
            mixer: { channels: channels.map(toProjectMixerChannel) },
          },
        }
        return structuredClone(project)
      },
    },
    voices: {
      async search(query) {
        await wait()
        const normalized = query.trim().toLowerCase()
        return VOICES.filter((voice) =>
          !normalized ||
          voice.name.toLowerCase().includes(normalized) ||
          voice.category.toLowerCase().includes(normalized),
        ).map((voice) => ({ ...voice }))
      },
    },
  }
}

export function channelsFromProject(project: MixerProject): MixerChannel[] {
  return project.channels.map((channel) => ({ ...channel }))
}
