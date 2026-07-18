import { createUnknownMixerChannels } from "./state"
import type { MixerChannel } from "./types"

/** Browser stand-in for desktop `.tyrosmix` — essential channel levels only. */
export const MIX_FILE_VERSION = "web-1.0"
export const MIX_FILE_EXTENSION = "tyrosmix"

export type MixFileDocument = {
  version: string
  application: "SmartBridge"
  mixer: "GenosMixer"
  schema: "web_channels"
  timestamp: string
  channels: Array<{
    part: number
    voiceId: string
    voiceName: string
    volume: number
    pan: number
    reverb: number
    chorus: number
    muted: boolean
  }>
}

export function serializeMixFile(channels: readonly MixerChannel[]): MixFileDocument {
  return {
    version: MIX_FILE_VERSION,
    application: "SmartBridge",
    mixer: "GenosMixer",
    schema: "web_channels",
    timestamp: new Date().toISOString(),
    channels: channels.map((channel) => ({
      part: channel.part,
      voiceId: channel.voiceId,
      voiceName: channel.voiceName,
      volume: channel.volume,
      pan: channel.pan,
      reverb: channel.reverb,
      chorus: channel.chorus,
      muted: channel.mute,
    })),
  }
}

export function parseMixFile(raw: unknown): MixerChannel[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("Mix file is not valid JSON.")
  }
  const doc = raw as Partial<MixFileDocument>
  if (!Array.isArray(doc.channels)) {
    throw new Error("Mix file has no channels.")
  }

  const base = createUnknownMixerChannels()
  const byPart = new Map(
    doc.channels
      .filter((row) => row && typeof row.part === "number")
      .map((row) => [row.part, row] as const),
  )

  return base.map((channel) => {
    const saved = byPart.get(channel.part)
    if (!saved) return channel
    return {
      ...channel,
      voiceId: typeof saved.voiceId === "string" ? saved.voiceId : channel.voiceId,
      voiceName:
        typeof saved.voiceName === "string" && saved.voiceName.trim()
          ? saved.voiceName
          : channel.voiceName,
      volume: clampMidi(saved.volume, channel.volume),
      pan: clampMidi(saved.pan, channel.pan),
      reverb: clampMidi(saved.reverb, channel.reverb),
      chorus: clampMidi(saved.chorus, channel.chorus),
      mute: Boolean(saved.muted),
      known: true,
    }
  })
}

function clampMidi(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(127, Math.round(value)))
}

export function downloadMixFile(channels: readonly MixerChannel[], basename = "SmartBridge_Mix") {
  const document = serializeMixFile(channels)
  const blob = new Blob([JSON.stringify(document, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement("a")
  anchor.href = url
  anchor.download = `${basename}.${MIX_FILE_EXTENSION}`
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function readMixFile(file: File): Promise<MixerChannel[]> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("Mix file could not be read as JSON.")
  }
  return parseMixFile(parsed)
}
