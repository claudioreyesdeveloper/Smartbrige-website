import type { YamahaModelId } from "@/lib/yamaha/types"
import {
  MULTI_PART_OFFSET,
  bankForChannel,
  channelsForProtocolPart,
  decodeMixerMessage,
  labelForChannel,
  parameterMessage,
  partsForBank,
  portForChannel,
  protocolPartForChannel,
  refreshChannelsForPart,
  voiceMessages,
  xgDumpRequest,
} from "@/lib/mixer/protocol"
import type {
  MixerBank,
  MixerBankRefresh,
  MixerChannelState,
  MixerClock,
  MixerParameter,
  MixerPort,
  MixerSnapshot,
  MixerTransport,
  MixerVoice,
} from "@/lib/mixer/types"

const defaultClock: MixerClock = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}

type PendingRequest = {
  bank: MixerBank
  part: number
  channels: number[]
}

export class MixerEngine extends EventTarget {
  private channels: MixerChannelState[]
  private refreshState: Record<MixerBank, MixerBankRefresh>
  private pending = new Map<string, PendingRequest>()
  private recentCcVolume = new Map<number, { value: number; at: number }>()
  private bankMsb = new Array<number | null>(32).fill(null)
  private bankLsb = new Array<number | null>(32).fill(null)
  private refreshTimer: unknown = null
  private connected = false

  constructor(
    private readonly transport: MixerTransport,
    private readonly model: YamahaModelId,
    private readonly clock: MixerClock = defaultClock,
    private readonly refreshTimeoutMs = 3000,
  ) {
    super()
    this.channels = Array.from({ length: 32 }, (_, index) => {
      const channel = index + 1
      return {
        channel,
        bank: bankForChannel(channel),
        port: portForChannel(channel),
        label: labelForChannel(channel),
        protocolPart: protocolPartForChannel(channel),
        modelOrigin: model,
        known: false,
        stale: false,
        origin: "unknown",
        volume: null,
        pan: null,
        reverb: null,
        chorus: null,
        voice: null,
        muted: false,
      }
    })
    this.refreshState = {
      style: emptyRefresh(),
      song: emptyRefresh(),
    }
  }

  get state(): MixerSnapshot {
    return {
      connected: this.connected,
      model: this.model,
      channels: this.channels.map(cloneChannel),
      refresh: {
        style: { ...this.refreshState.style },
        song: { ...this.refreshState.song },
      },
    }
  }

  setConnected(connected: boolean): void {
    if (this.connected === connected) return
    this.connected = connected
    if (!connected) {
      this.cancelRefreshTimer()
      this.pending.clear()
      this.channels.forEach((channel) => {
        channel.stale = channel.known
      })
      const now = this.clock.now()
      this.refreshState.style = disconnectedRefresh(this.refreshState.style, now)
      this.refreshState.song = disconnectedRefresh(this.refreshState.song, now)
    }
    this.publish()
  }

  refresh(): void {
    this.requireConnected()
    this.cancelRefreshTimer()
    this.pending.clear()
    this.refreshState = { style: emptyRefresh(), song: emptyRefresh() }
    this.channels.forEach((channel) => {
      if (channel.known) channel.stale = true
    })
    this.startBankRefresh("style")
  }

  setParameter(channelNumber: number, parameter: MixerParameter, value: number): void {
    const channel = this.getChannel(channelNumber)
    const normalized = data7(value)
    channel[parameter] = normalized
    channel.known = true
    channel.stale = false
    channel.origin = "ui"
    const wireValue = parameter === "volume" && channel.muted ? 0 : normalized
    this.send(channel.port, parameterMessage(channelNumber, parameter, wireValue))
    this.publish()
  }

  setVoice(channelNumber: number, voice: MixerVoice): void {
    const channel = this.getChannel(channelNumber)
    const normalized = normalizeVoice(voice)
    channel.voice = normalized
    channel.known = true
    channel.stale = false
    channel.origin = "ui"
    this.bankMsb[channelNumber - 1] = normalized.msb
    this.bankLsb[channelNumber - 1] = normalized.lsb
    voiceMessages(channelNumber, normalized).forEach((message) => this.send(channel.port, message))
    this.publish()
  }

  setMute(channelNumber: number, muted: boolean): void {
    const channel = this.getChannel(channelNumber)
    if (channel.muted === muted) return
    channel.muted = muted
    channel.known = true
    channel.stale = false
    channel.origin = "ui"
    const audibleVolume = channel.volume ?? 100
    this.send(channel.port, parameterMessage(channelNumber, "volume", muted ? 0 : audibleVolume))
    this.publish()
  }

  handleMidi(data: Uint8Array, sourcePort: MixerPort | null): boolean {
    const decoded = decodeMixerMessage(data)
    if (!decoded) return false

    if (decoded.kind === "bulk") {
      const pending = this.pendingForPart(decoded.part)
      if (pending) {
        pending.channels.forEach((channel) =>
          this.applyBulk(channel, decoded.payload, decoded.startOffset),
        )
        this.completePending(pending)
        return true
      }
      if (!sourcePort) return false
      const channels = channelsForProtocolPart(sourcePort, decoded.part)
      channels.forEach((channel) => this.applyBulk(channel, decoded.payload, decoded.startOffset))
      if (channels.length) this.publish()
      return channels.length > 0
    }

    if (decoded.kind === "parameter") {
      const pending = this.pendingForPart(decoded.part)
      const channels = pending
        ? pending.channels
        : sourcePort
          ? channelsForProtocolPart(sourcePort, decoded.part)
          : []
      channels.forEach((channel) =>
        this.applyHardwareParameter(channel, decoded.parameter, decoded.value, false),
      )
      if (channels.length) this.publish()
      return channels.length > 0
    }

    if (!sourcePort) return false
    const channel = sourcePort === "port1" ? decoded.midiChannel + 16 : decoded.midiChannel
    if (decoded.kind === "cc") {
      this.applyHardwareParameter(channel, decoded.parameter, decoded.value, true)
    } else {
      this.applyHardwareParameter(channel, "program", decoded.value, true)
    }
    this.publish()
    return true
  }

  private startBankRefresh(bank: MixerBank): void {
    const now = this.clock.now()
    const parts = partsForBank(bank)
    this.refreshState[bank] = {
      status: "loading",
      requested: parts.length,
      replied: 0,
      startedAt: now,
      finishedAt: null,
    }
    parts.forEach((part) => {
      const request = {
        bank,
        part,
        channels: refreshChannelsForPart(bank, part),
      }
      this.pending.set(requestKey(bank, part), request)
      this.send(bank === "style" ? "port2" : "port1", xgDumpRequest(part))
    })
    this.cancelRefreshTimer()
    this.refreshTimer = this.clock.setTimeout(() => this.timeoutBank(bank), this.refreshTimeoutMs)
    this.publish()
  }

  private timeoutBank(bank: MixerBank): void {
    if (this.refreshState[bank].status !== "loading") return
    this.pendingForBank(bank).forEach((request) => {
      request.channels.forEach((channel) => {
        const state = this.channels[channel - 1]
        state.stale = state.known
      })
      this.pending.delete(requestKey(bank, request.part))
    })
    this.refreshState[bank].status = "timed-out"
    this.refreshState[bank].finishedAt = this.clock.now()
    this.refreshTimer = null
    if (bank === "style") this.startBankRefresh("song")
    else this.publish()
  }

  private completePending(request: PendingRequest): void {
    const key = requestKey(request.bank, request.part)
    if (!this.pending.delete(key)) return
    const refresh = this.refreshState[request.bank]
    refresh.replied += 1
    if (refresh.replied < refresh.requested) {
      this.publish()
      return
    }
    refresh.status = "loaded"
    refresh.finishedAt = this.clock.now()
    this.cancelRefreshTimer()
    if (request.bank === "style") this.startBankRefresh("song")
    else this.publish()
  }

  private applyBulk(channelNumber: number, payload: Uint8Array, startOffset: number): void {
    const valueAt = (offset: number) => {
      const index = offset - startOffset
      return index >= 0 && index < payload.length ? payload[index] : null
    }
    const msb = valueAt(MULTI_PART_OFFSET.bankMsb)
    const lsb = valueAt(MULTI_PART_OFFSET.bankLsb)
    const program = valueAt(MULTI_PART_OFFSET.program)
    if (msb !== null) this.bankMsb[channelNumber - 1] = msb
    if (lsb !== null) this.bankLsb[channelNumber - 1] = lsb
    if (program !== null && this.bankMsb[channelNumber - 1] !== null && this.bankLsb[channelNumber - 1] !== null) {
      this.getChannel(channelNumber).voice = {
        msb: this.bankMsb[channelNumber - 1]!,
        lsb: this.bankLsb[channelNumber - 1]!,
        program: program + 1,
      }
    }
    this.applyBulkValue(channelNumber, "volume", valueAt(MULTI_PART_OFFSET.volume))
    this.applyBulkValue(channelNumber, "pan", valueAt(MULTI_PART_OFFSET.pan))
    this.applyBulkValue(channelNumber, "chorus", valueAt(MULTI_PART_OFFSET.chorus))
    this.applyBulkValue(channelNumber, "reverb", valueAt(MULTI_PART_OFFSET.reverb))
    const channel = this.getChannel(channelNumber)
    channel.known = true
    channel.stale = false
    channel.origin = "hardware"
  }

  private applyBulkValue(
    channelNumber: number,
    parameter: MixerParameter,
    value: number | null,
  ): void {
    if (value === null) return
    if (parameter === "volume" && this.preferRecentCcVolume(channelNumber, value)) return
    this.getChannel(channelNumber)[parameter] = value
  }

  private applyHardwareParameter(
    channelNumber: number,
    parameter: MixerParameter | "bankMsb" | "bankLsb" | "program" | "unknown",
    value: number,
    fromCc: boolean,
  ): void {
    if (parameter === "unknown") return
    const channel = this.getChannel(channelNumber)
    if (parameter === "bankMsb") this.bankMsb[channelNumber - 1] = value
    else if (parameter === "bankLsb") this.bankLsb[channelNumber - 1] = value
    else if (parameter === "program") {
      const msb = this.bankMsb[channelNumber - 1]
      const lsb = this.bankLsb[channelNumber - 1]
      if (msb !== null && lsb !== null) channel.voice = { msb, lsb, program: value + 1 }
    } else if (parameter === "volume") {
      if (fromCc) this.recentCcVolume.set(channelNumber, { value, at: this.clock.now() })
      if (!fromCc && this.preferRecentCcVolume(channelNumber, value)) return
      channel.volume = value
    } else {
      channel[parameter] = value
    }
    channel.known = true
    channel.stale = false
    channel.origin = "hardware"
  }

  private preferRecentCcVolume(channel: number, incoming: number): boolean {
    const recent = this.recentCcVolume.get(channel)
    if (!recent || this.clock.now() - recent.at > 3000) return false
    return Math.abs(recent.value - incoming) >= 2
  }

  private pendingForPart(part: number): PendingRequest | null {
    const loadingBank =
      this.refreshState.style.status === "loading"
        ? "style"
        : this.refreshState.song.status === "loading"
          ? "song"
          : null
    return loadingBank ? this.pending.get(requestKey(loadingBank, part)) || null : null
  }

  private pendingForBank(bank: MixerBank): PendingRequest[] {
    return Array.from(this.pending.values()).filter((request) => request.bank === bank)
  }

  private getChannel(channel: number): MixerChannelState {
    if (!Number.isInteger(channel) || channel < 1 || channel > 32) {
      throw new RangeError("Mixer channel must be 1-32.")
    }
    return this.channels[channel - 1]
  }

  private send(port: MixerPort, data: Uint8Array): void {
    this.requireConnected()
    if (port === "port1") this.transport.sendPort1(data)
    else this.transport.sendPort2(data)
  }

  private requireConnected(): void {
    if (!this.connected) throw new Error("Connect the keyboard before using the mixer.")
  }

  private cancelRefreshTimer(): void {
    if (this.refreshTimer === null) return
    this.clock.clearTimeout(this.refreshTimer)
    this.refreshTimer = null
  }

  private publish(): void {
    this.dispatchEvent(new CustomEvent("statechange", { detail: this.state }))
  }
}

function emptyRefresh(): MixerBankRefresh {
  return {
    status: "idle",
    requested: 0,
    replied: 0,
    startedAt: null,
    finishedAt: null,
  }
}

function disconnectedRefresh(previous: MixerBankRefresh, now: number): MixerBankRefresh {
  return {
    ...previous,
    status: "disconnected",
    finishedAt: previous.startedAt === null ? null : now,
  }
}

function requestKey(bank: MixerBank, part: number): string {
  return `${bank}:${part}`
}

function normalizeVoice(voice: MixerVoice): MixerVoice {
  return {
    msb: data7(voice.msb),
    lsb: data7(voice.lsb),
    program: Math.max(1, Math.min(128, Math.round(voice.program))),
  }
}

function data7(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)))
}

function cloneChannel(channel: MixerChannelState): MixerChannelState {
  return {
    ...channel,
    voice: channel.voice ? { ...channel.voice } : null,
  }
}
