import type { YamahaModelId } from "@/lib/yamaha/types"
import type {
  MixerBank,
  MixerParameter,
  MixerPort,
  MixerProfile,
  MixerVoice,
} from "@/lib/mixer/types"

const YAMAHA = 0x43
const XG_MODEL = 0x4c
const PARAM_CHANGE = 0x10
const DUMP_REPLY = 0x00
const DUMP_REQUEST = 0x20
const MULTI_PART = 0x08

export const MULTI_PART_OFFSET = {
  bankMsb: 0x01,
  bankLsb: 0x02,
  program: 0x03,
  volume: 0x0b,
  pan: 0x0e,
  chorus: 0x12,
  reverb: 0x13,
} as const

export const MIXER_PROFILES: Readonly<Record<YamahaModelId, MixerProfile>> = {
  genos: {
    model: "genos",
    displayName: "Genos",
    xgModelByte: XG_MODEL,
    stylePort: "port2",
    songPort: "port1",
    protocolDifference: "none-in-repository",
    evidence: ["A05 Genos fixture", "desktop YamahaProtocol XG contract"],
  },
  genos2: {
    model: "genos2",
    displayName: "Genos2",
    xgModelByte: XG_MODEL,
    stylePort: "port2",
    songPort: "port1",
    protocolDifference: "none-in-repository",
    evidence: ["desktop YamahaProtocol", "desktop TyrosMixerScreen"],
  },
  tyros5: {
    model: "tyros5",
    displayName: "Tyros5",
    xgModelByte: XG_MODEL,
    stylePort: "port2",
    songPort: "port1",
    protocolDifference: "none-in-repository",
    evidence: ["desktop LocalMidiConnector", "desktop TyrosMixerScreen"],
  },
  tyros4: {
    model: "tyros4",
    displayName: "Tyros4",
    xgModelByte: XG_MODEL,
    stylePort: "port2",
    songPort: "port1",
    protocolDifference: "unknown",
    evidence: ["no model-specific mixer difference found in inspected repository"],
  },
}

const STYLE_LABELS = [
  "Right 1",
  "Right 2",
  "Right 3",
  "Left",
  "Multi Pad 1",
  "Multi Pad 2",
  "Multi Pad 3",
  "Multi Pad 4",
  "Rhythm 1",
  "Rhythm 2",
  "Bass",
  "Chord 1",
  "Chord 2",
  "Pad",
  "Phrase 1",
  "Phrase 2",
] as const

export function bankForChannel(channel: number): MixerBank {
  assertChannel(channel)
  return channel <= 16 ? "style" : "song"
}

export function portForChannel(channel: number): MixerPort {
  return bankForChannel(channel) === "style" ? "port2" : "port1"
}

export function labelForChannel(channel: number): string {
  assertChannel(channel)
  return channel <= 16 ? STYLE_LABELS[channel - 1] : `Song ${channel - 16}`
}

export function protocolPartForChannel(channel: number): number {
  assertChannel(channel)
  if (channel >= 17) return channel - 17
  if (channel >= 9) return channel - 1
  return channel
}

export function channelsForProtocolPart(port: MixerPort, part: number): number[] {
  if (!Number.isInteger(part) || part < 0 || part > 0x0f) return []
  if (port === "port1") return [part + 17]
  if (part === 0x08) return [8, 9]
  if (part >= 0x09) return [part + 1]
  if (part >= 0x01) return [part]
  return []
}

export function refreshChannelsForPart(bank: MixerBank, part: number): number[] {
  if (bank === "song") return channelsForProtocolPart("port1", part)
  if (part === 0x08) return [9]
  return channelsForProtocolPart("port2", part)
}

export function partsForBank(bank: MixerBank): number[] {
  return bank === "style"
    ? Array.from({ length: 15 }, (_, index) => index + 1)
    : Array.from({ length: 16 }, (_, index) => index)
}

export function xgParameterChange(part: number, offset: number, value: number): Uint8Array {
  return Uint8Array.of(
    0xf0,
    YAMAHA,
    PARAM_CHANGE,
    XG_MODEL,
    MULTI_PART,
    data7(part),
    data7(offset),
    data7(value),
    0xf7,
  )
}

export function xgDumpRequest(part: number): Uint8Array {
  return Uint8Array.of(
    0xf0,
    YAMAHA,
    DUMP_REQUEST,
    XG_MODEL,
    MULTI_PART,
    data7(part),
    0x00,
    0xf7,
  )
}

export function ccMessage(midiChannel: number, controller: number, value: number): Uint8Array {
  if (!Number.isInteger(midiChannel) || midiChannel < 1 || midiChannel > 16) {
    throw new RangeError("MIDI channel must be 1-16.")
  }
  return Uint8Array.of(0xaf + midiChannel, data7(controller), data7(value))
}

export function programMessage(midiChannel: number, programZeroBased: number): Uint8Array {
  if (!Number.isInteger(midiChannel) || midiChannel < 1 || midiChannel > 16) {
    throw new RangeError("MIDI channel must be 1-16.")
  }
  return Uint8Array.of(0xbf + midiChannel, data7(programZeroBased))
}

export function parameterMessage(
  channel: number,
  parameter: MixerParameter,
  value: number,
): Uint8Array {
  const clamped = data7(value)
  if (channel <= 16) {
    const offset = {
      volume: MULTI_PART_OFFSET.volume,
      pan: MULTI_PART_OFFSET.pan,
      reverb: MULTI_PART_OFFSET.reverb,
      chorus: MULTI_PART_OFFSET.chorus,
    }[parameter]
    return xgParameterChange(protocolPartForChannel(channel), offset, clamped)
  }
  const controller = { volume: 7, pan: 10, reverb: 91, chorus: 93 }[parameter]
  return ccMessage(channel - 16, controller, clamped)
}

export function voiceMessages(channel: number, voice: MixerVoice): Uint8Array[] {
  const msb = data7(voice.msb)
  const lsb = data7(voice.lsb)
  const program = clampProgram(voice.program) - 1
  if (channel <= 16) {
    const part = protocolPartForChannel(channel)
    return [
      xgParameterChange(part, MULTI_PART_OFFSET.bankMsb, msb),
      xgParameterChange(part, MULTI_PART_OFFSET.bankLsb, lsb),
      xgParameterChange(part, MULTI_PART_OFFSET.program, program),
    ]
  }
  const midiChannel = channel - 16
  return [
    ccMessage(midiChannel, 0, msb),
    ccMessage(midiChannel, 32, lsb),
    programMessage(midiChannel, program),
  ]
}

export type DecodedMixerMessage =
  | {
      kind: "parameter"
      part: number
      parameter: MixerParameter | "bankMsb" | "bankLsb" | "program" | "unknown"
      value: number
    }
  | { kind: "bulk"; part: number; startOffset: number; payload: Uint8Array }
  | {
      kind: "cc"
      midiChannel: number
      parameter: MixerParameter | "bankMsb" | "bankLsb" | "unknown"
      value: number
    }
  | { kind: "program"; midiChannel: number; value: number }

export function decodeMixerMessage(data: Uint8Array): DecodedMixerMessage | null {
  if (data.length >= 9 && data[0] === 0xf0 && data.at(-1) === 0xf7 && data[1] === YAMAHA) {
    if (
      (data[2] & 0xf0) === PARAM_CHANGE &&
      data[3] === XG_MODEL &&
      data[4] === MULTI_PART
    ) {
      return {
        kind: "parameter",
        part: data[5],
        parameter: parameterFromOffset(data[6]),
        value: data[7],
      }
    }
    if (
      (data[2] & 0xf0) === DUMP_REPLY &&
      data[3] === XG_MODEL &&
      data.length >= 11 &&
      data[6] === MULTI_PART
    ) {
      const declaredSize = (data[4] << 7) | data[5]
      const payload = data.slice(9, -2)
      if (declaredSize !== payload.length + 4) return null
      if (!validBulkChecksum(data.slice(6, -2), data.at(-2)!)) return null
      return { kind: "bulk", part: data[7], startOffset: data[8], payload }
    }
    return null
  }

  const status = data[0]
  if (data.length === 3 && status >= 0xb0 && status <= 0xbf) {
    const parameters: Record<
      number,
      MixerParameter | "bankMsb" | "bankLsb"
    > = {
      0: "bankMsb",
      7: "volume",
      10: "pan",
      32: "bankLsb",
      91: "reverb",
      93: "chorus",
    }
    return {
      kind: "cc",
      midiChannel: (status & 0x0f) + 1,
      parameter: parameters[data[1]] || "unknown",
      value: data[2],
    }
  }
  if (data.length === 2 && status >= 0xc0 && status <= 0xcf) {
    return { kind: "program", midiChannel: (status & 0x0f) + 1, value: data[1] }
  }
  return null
}

export function bulkReply(part: number, payload: Uint8Array, startOffset = 0): Uint8Array {
  const size = payload.length + 4
  const body = Uint8Array.from([
    MULTI_PART,
    data7(part),
    data7(startOffset),
    ...payload,
  ])
  return Uint8Array.from([
    0xf0,
    YAMAHA,
    DUMP_REPLY,
    XG_MODEL,
    (size >> 7) & 0x7f,
    size & 0x7f,
    ...body,
    checksum(body),
    0xf7,
  ])
}

function parameterFromOffset(
  offset: number,
): MixerParameter | "bankMsb" | "bankLsb" | "program" | "unknown" {
  const known: Record<number, MixerParameter | "bankMsb" | "bankLsb" | "program"> = {
    [MULTI_PART_OFFSET.bankMsb]: "bankMsb",
    [MULTI_PART_OFFSET.bankLsb]: "bankLsb",
    [MULTI_PART_OFFSET.program]: "program",
    [MULTI_PART_OFFSET.volume]: "volume",
    [MULTI_PART_OFFSET.pan]: "pan",
    [MULTI_PART_OFFSET.chorus]: "chorus",
    [MULTI_PART_OFFSET.reverb]: "reverb",
  }
  return known[offset] || "unknown"
}

function checksum(data: Uint8Array): number {
  return (128 - (data.reduce((sum, byte) => sum + byte, 0) % 128)) % 128
}

function validBulkChecksum(data: Uint8Array, expected: number): boolean {
  return checksum(data) === expected
}

function data7(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(127, Math.round(value)))
}

function clampProgram(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(128, Math.round(value)))
}

function assertChannel(channel: number): void {
  if (!Number.isInteger(channel) || channel < 1 || channel > 32) {
    throw new RangeError("Mixer channel must be 1-32.")
  }
}
