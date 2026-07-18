import type { ProjectDocument, ProjectMixerChannel } from "@/lib/projects/document"

export type MixerPage = "style" | "song"
export type MixerConnectionPhase = "unknown" | "connected" | "refreshing" | "error"

export type MixerVoice = {
  id: string
  name: string
  category: string
  msb?: number
  lsb?: number
  program?: number
}

export type MixerChannel = {
  part: number
  label: string
  voiceId: string
  voiceName: string
  volume: number
  pan: number
  reverb: number
  chorus: number
  mute: boolean
  known: boolean
}

export type MixerConnectionState = {
  phase: MixerConnectionPhase
  model: string | null
  progress: number
  message: string
}

export type MixerProject = {
  id: string
  title: string
  document: ProjectDocument
  channels: MixerChannel[]
}

export type MixerProjectAdapter = {
  list(): Promise<MixerProject[]>
  open(projectId: string): Promise<MixerProject>
  save(projectId: string, channels: readonly MixerChannel[]): Promise<MixerProject>
}

export type MixerChannelChange = "volume" | "pan" | "reverb" | "chorus" | "mute" | "voice"

export type MixerDeviceAdapter = {
  getState(): MixerConnectionState
  subscribe(listener: (state: MixerConnectionState) => void): () => void
  refresh(): Promise<readonly MixerChannel[]>
  updateChannel(channel: MixerChannel, change: MixerChannelChange): void
}

export type MixerVoiceAdapter = {
  search(query: string): Promise<readonly MixerVoice[]>
}

export type GenosMixerAdapters = {
  device: MixerDeviceAdapter
  projects: MixerProjectAdapter
  voices: MixerVoiceAdapter
  dispose?(): void
}

export type MixerWorkspaceState = {
  page: MixerPage
  channels: MixerChannel[]
  selectedVoicePart: number | null
}

export type MixerWorkspaceAction =
  | { type: "select-page"; page: MixerPage }
  | { type: "replace-channels"; channels: readonly MixerChannel[] }
  | { type: "change-level"; part: number; field: "volume" | "pan" | "reverb" | "chorus"; value: number }
  | { type: "toggle-mute"; part: number }
  | { type: "open-voice"; part: number }
  | { type: "close-voice" }
  | { type: "select-voice"; part: number; voice: MixerVoice }

export function toProjectMixerChannel(channel: MixerChannel): ProjectMixerChannel {
  return {
    part: channel.part,
    volume: channel.volume,
    pan: channel.pan,
    reverb: channel.reverb,
    chorus: channel.chorus,
    mute: channel.mute,
    voiceId: channel.voiceId,
  }
}
