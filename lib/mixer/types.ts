import type { YamahaModelId } from "@/lib/yamaha/types"

export type MixerPort = "port1" | "port2"
export type MixerBank = "style" | "song"
export type MixerOrigin = "unknown" | "hardware" | "ui"
export type MixerParameter = "volume" | "pan" | "reverb" | "chorus"
export type MixerRefreshStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "timed-out"
  | "disconnected"

export type MixerVoice = {
  msb: number
  lsb: number
  program: number
}

export type MixerChannelState = {
  channel: number
  bank: MixerBank
  port: MixerPort
  label: string
  protocolPart: number
  modelOrigin: YamahaModelId | null
  known: boolean
  stale: boolean
  origin: MixerOrigin
  volume: number | null
  pan: number | null
  reverb: number | null
  chorus: number | null
  voice: MixerVoice | null
  muted: boolean
}

export type MixerBankRefresh = {
  status: MixerRefreshStatus
  requested: number
  replied: number
  startedAt: number | null
  finishedAt: number | null
}

export type MixerSnapshot = {
  connected: boolean
  model: YamahaModelId
  channels: readonly MixerChannelState[]
  refresh: Readonly<Record<MixerBank, MixerBankRefresh>>
}

export type MixerClock = {
  now(): number
  setTimeout(callback: () => void, delayMs: number): unknown
  clearTimeout(handle: unknown): void
}

export type MixerTransport = {
  sendPort1(data: Uint8Array): void
  sendPort2(data: Uint8Array): void
}

export type MixerProfile = {
  model: YamahaModelId
  displayName: string
  xgModelByte: 0x4c
  stylePort: "port2"
  songPort: "port1"
  protocolDifference: "none-in-repository" | "unknown"
  evidence: readonly string[]
}
