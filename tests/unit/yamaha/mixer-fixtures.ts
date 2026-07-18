import golden from "@/tests/fixtures/yamaha-mixer/desktop-golden.json"
import type { YamahaModelId } from "@/lib/yamaha/types"

export type MixerPort = "port1" | "port2"
export type MixerBank = "style" | "song"
export type EssentialMixerControl =
  | "volume"
  | "pan"
  | "reverb"
  | "chorus"
  | "voice"
  | "mute"

export type MixerChannelFixture = {
  uiChannel: number
  bank: MixerBank
  outputPort: MixerPort
  midiChannel: number
  xgPart: number
  authoritativeInbound: boolean
}

export type MixerWireMessage = {
  id: string
  generation: number
  bank: MixerBank
  uiChannel: number
  port: MixerPort
  kind: "bulk" | "parameter"
  addressHigh: number
  part: number
  parameter: number
  bytes: number[]
}

export type MixerReply = MixerWireMessage & {
  value?: number
}

export type MixerFixtureScenario =
  | "happy"
  | "out-of-order"
  | "stale"
  | "timeout"
  | "disconnect"
  | "recent-cc-conflict"

export type MixerHarnessResult = {
  appliedReplyIds: string[]
  ignoredReplyIds: string[]
  pendingReplyIds: string[]
  disconnected: boolean
  timedOut: boolean
  volume: Readonly<Record<number, number>>
}

export interface MixerFixtureAdapter {
  run(
    requests: readonly MixerWireMessage[],
    replies: readonly MixerReply[],
    scenario: MixerFixtureScenario,
  ): MixerHarnessResult
}

const F0 = 0xf0
const F7 = 0xf7
const PARAM_CHANGE = golden.envelope.parameterChange
const DUMP_REQUEST = golden.envelope.dumpRequest
const PARAM_REQUEST = golden.envelope.parameterRequest
const XG = golden.envelope.modelIdXg
const YAMAHA = golden.envelope.yamahaId
const MULTI = golden.envelope.multiPartAddress
const MULTI_EXT = golden.parameters.songEqAddress

export const VERIFIED_MIXER_GOLDEN = golden
export const SUPPORTED_MIXER_MODELS = golden.verifiedModels as YamahaModelId[]
export const MODEL_SELECTION_FIXTURES: ReadonlyArray<{
  model: YamahaModelId
  displayName: string
  identityRequest: number[]
  identityReply?: number[]
}> = [
  {
    model: "genos",
    displayName: "Genos",
    identityRequest: [F0, 0x7e, 0x7f, 0x06, 0x01, F7],
    identityReply: [F0, 0x7e, 0x7f, 0x06, 0x02, YAMAHA, 0x00, 0x44, 0x42, 0x1c, F7],
  },
  {
    model: "genos2",
    displayName: "Genos2",
    identityRequest: [F0, 0x7e, 0x7f, 0x06, 0x01, F7],
    identityReply: [F0, 0x7e, 0x7f, 0x06, 0x02, YAMAHA, 0x7f, 0x68, 0x00, 0x00, F7],
  },
  {
    model: "tyros4",
    displayName: "Tyros4",
    identityRequest: [F0, 0x7e, 0x7f, 0x06, 0x01, F7],
  },
  {
    model: "tyros5",
    displayName: "Tyros5",
    identityRequest: [F0, 0x7e, 0x7f, 0x06, 0x01, F7],
    identityReply: [F0, 0x7e, 0x7f, 0x06, 0x02, YAMAHA, 0x7f, 0x7f, 0x00, 0x00, F7],
  },
]

export function xgPartForUiChannel(uiChannel: number): number {
  if (uiChannel < 1 || uiChannel > golden.channelCount) {
    throw new RangeError(`Mixer UI channel must be 1-${golden.channelCount}.`)
  }
  if (uiChannel >= 17) return uiChannel - 17
  if (uiChannel >= 9) return uiChannel - 1
  return uiChannel
}

export const MIXER_CHANNEL_FIXTURES: MixerChannelFixture[] = Array.from(
  { length: golden.channelCount },
  (_, index) => {
    const uiChannel = index + 1
    const bank: MixerBank = uiChannel <= 16 ? "style" : "song"
    return {
      uiChannel,
      bank,
      outputPort: bank === "style" ? "port2" : "port1",
      midiChannel: bank === "style" ? uiChannel : uiChannel - 16,
      xgPart: xgPartForUiChannel(uiChannel),
      authoritativeInbound: uiChannel !== golden.sharedPart.excludedRefreshUiChannel,
    }
  },
)

function parameterChange(part: number, parameter: number, value: number): number[] {
  return [F0, YAMAHA, PARAM_CHANGE, XG, MULTI, part, parameter, value, F7]
}

function cc(midiChannel: number, controller: number, value: number): number[] {
  return [0xaf + midiChannel, controller, value]
}

export function essentialControlMessages(
  channel: MixerChannelFixture,
): Record<EssentialMixerControl, number[][]> {
  const value = 20 + channel.uiChannel
  if (channel.bank === "style") {
    return {
      volume: [parameterChange(channel.xgPart, golden.parameters.volume, value)],
      pan: [parameterChange(channel.xgPart, golden.parameters.pan, value)],
      reverb: [parameterChange(channel.xgPart, golden.parameters.reverb, value)],
      chorus: [parameterChange(channel.xgPart, golden.parameters.chorus, value)],
      voice: [
        parameterChange(channel.xgPart, golden.parameters.bankMsb, 0),
        parameterChange(channel.xgPart, golden.parameters.bankLsb, 0),
        parameterChange(channel.xgPart, golden.parameters.program, 0),
      ],
      mute: [parameterChange(channel.xgPart, golden.parameters.volume, 0)],
    }
  }

  return {
    volume: [cc(channel.midiChannel, 7, value)],
    pan: [cc(channel.midiChannel, 10, value)],
    reverb: [cc(channel.midiChannel, 91, value)],
    chorus: [cc(channel.midiChannel, 93, value)],
    voice: [
      cc(channel.midiChannel, 0, 0),
      cc(channel.midiChannel, 32, 0),
      [0xbf + channel.midiChannel, 0],
    ],
    mute: [cc(channel.midiChannel, 7, 0)],
  }
}

function requestBytes(kind: "bulk" | "parameter", addressHigh: number, part: number, parameter: number) {
  return [
    F0,
    YAMAHA,
    kind === "bulk" ? DUMP_REQUEST : PARAM_REQUEST,
    XG,
    addressHigh,
    part,
    parameter,
    F7,
  ]
}

function refreshParts(bank: MixerBank): MixerChannelFixture[] {
  const seen = new Set<number>()
  return MIXER_CHANNEL_FIXTURES.filter((channel) => {
    if (channel.bank !== bank || !channel.authoritativeInbound || seen.has(channel.xgPart)) {
      return false
    }
    seen.add(channel.xgPart)
    return true
  })
}

export function buildRefreshRequests(bank: MixerBank, generation = 1): MixerWireMessage[] {
  const parameters = [
    { addressHigh: MULTI, parameter: golden.parameters.volume },
    { addressHigh: MULTI, parameter: golden.parameters.pan },
    { addressHigh: MULTI, parameter: golden.parameters.chorus },
    { addressHigh: MULTI, parameter: golden.parameters.reverb },
    {
      addressHigh: bank === "style" ? MULTI : MULTI_EXT,
      parameter:
        bank === "style" ? golden.parameters.styleEqBass : golden.parameters.songEqBass,
    },
    {
      addressHigh: bank === "style" ? MULTI : MULTI_EXT,
      parameter:
        bank === "style" ? golden.parameters.styleEqTreble : golden.parameters.songEqTreble,
    },
  ]

  return refreshParts(bank).flatMap((channel) => {
    const base = `${generation}:${bank}:${channel.xgPart}`
    const bulk: MixerWireMessage = {
      id: `${base}:bulk`,
      generation,
      bank,
      uiChannel: channel.uiChannel,
      port: channel.outputPort,
      kind: "bulk",
      addressHigh: MULTI,
      part: channel.xgPart,
      parameter: 0,
      bytes: requestBytes("bulk", MULTI, channel.xgPart, 0),
    }
    return [
      bulk,
      ...parameters.map(({ addressHigh, parameter }) => ({
        id: `${base}:param:${addressHigh}:${parameter}`,
        generation,
        bank,
        uiChannel: channel.uiChannel,
        port: channel.outputPort,
        kind: "parameter" as const,
        addressHigh,
        part: channel.xgPart,
        parameter,
        bytes: requestBytes("parameter", addressHigh, channel.xgPart, parameter),
      })),
    ]
  })
}

function checksum7(bytes: readonly number[]): number {
  return (128 - (bytes.reduce((sum, byte) => sum + byte, 0) % 128)) % 128
}

function bulkReplyBytes(request: MixerWireMessage): number[] {
  const payload = Array.from({ length: 0x14 }, (_, offset) => {
    if (offset === golden.parameters.bankMsb) return 0
    if (offset === golden.parameters.bankLsb) return 0
    if (offset === golden.parameters.program) return 0
    if (offset === golden.parameters.volume) return 40 + (request.uiChannel % 40)
    if (offset === golden.parameters.pan) return 64
    if (offset === golden.parameters.chorus) return 20
    if (offset === golden.parameters.reverb) return 30
    return 0
  })
  const checked = [MULTI, request.part, 0, ...payload]
  return [F0, YAMAHA, 0, XG, 0, payload.length, ...checked, checksum7(checked), F7]
}

export function repliesForRequests(requests: readonly MixerWireMessage[]): MixerReply[] {
  return requests.map((request) => {
    const value = request.kind === "parameter" ? 40 + (request.uiChannel % 40) : undefined
    return {
      ...request,
      value,
      bytes:
        request.kind === "bulk"
          ? bulkReplyBytes(request)
          : [
              F0,
              YAMAHA,
              PARAM_CHANGE,
              XG,
              request.addressHigh,
              request.part,
              request.parameter,
              value!,
              F7,
            ],
    }
  })
}

export function shouldPreferRecentCcVolume(
  ccValue: number | null,
  ccAgeMs: number,
  incomingValue: number,
): boolean {
  return (
    ccValue !== null &&
    ccAgeMs <= golden.timing.recentCcConflictWindowMs &&
    Math.abs(ccValue - incomingValue) >= golden.timing.recentCcMinimumDifference
  )
}

export class VerifiedMockMixerAdapter implements MixerFixtureAdapter {
  run(
    requests: readonly MixerWireMessage[],
    replies: readonly MixerReply[],
    scenario: MixerFixtureScenario,
  ): MixerHarnessResult {
    const pending = new Map(requests.map((request) => [request.id, request]))
    const appliedReplyIds: string[] = []
    const ignoredReplyIds: string[] = []
    const volume: Record<number, number> = {}
    let disconnected = false
    let timedOut = false
    let stream = [...replies]

    if (scenario === "out-of-order") stream.reverse()
    if (scenario === "stale") {
      stream = stream.map((reply, index) =>
        index === 0 ? { ...reply, generation: reply.generation - 1, id: `stale:${reply.id}` } : reply,
      )
    }
    if (scenario === "timeout") stream = []
    if (scenario === "disconnect") {
      stream = stream.slice(0, Math.max(1, Math.floor(stream.length / 3)))
    }
    if (scenario === "recent-cc-conflict" && requests.length) {
      volume[requests[0].uiChannel] = 101
    }

    for (const reply of stream) {
      if (disconnected) {
        ignoredReplyIds.push(reply.id)
        continue
      }
      const expected = pending.get(reply.id.replace(/^stale:/, ""))
      if (
        !expected ||
        reply.generation !== expected.generation ||
        reply.bank !== expected.bank ||
        reply.addressHigh !== expected.addressHigh ||
        reply.part !== expected.part ||
        reply.parameter !== expected.parameter ||
        reply.kind !== expected.kind
      ) {
        ignoredReplyIds.push(reply.id)
        continue
      }

      if (
        scenario === "recent-cc-conflict" &&
        reply.kind === "parameter" &&
        reply.parameter === golden.parameters.volume &&
        shouldPreferRecentCcVolume(volume[reply.uiChannel] ?? null, 100, reply.value ?? 0)
      ) {
        ignoredReplyIds.push(reply.id)
        pending.delete(expected.id)
        continue
      }

      if (reply.kind === "parameter" && reply.parameter === golden.parameters.volume) {
        volume[reply.uiChannel] = reply.value ?? 0
      }
      pending.delete(expected.id)
      appliedReplyIds.push(reply.id)

      if (scenario === "disconnect" && appliedReplyIds.length === stream.length) {
        disconnected = true
      }
    }

    if (scenario === "timeout") timedOut = true

    return {
      appliedReplyIds,
      ignoredReplyIds,
      pendingReplyIds: [...pending.keys()],
      disconnected,
      timedOut,
      volume,
    }
  }
}

export const ALL_REFRESH_REQUESTS = [
  ...buildRefreshRequests("style"),
  ...buildRefreshRequests("song"),
]
export const ALL_REFRESH_REPLIES = repliesForRequests(ALL_REFRESH_REQUESTS)
