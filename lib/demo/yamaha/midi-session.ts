import type { KeyboardProfile, YamahaModelId } from "@/lib/demo/types"
import {
  clearCachedKeyboardPair,
  loadCachedKeyboardPair,
  resolveCachedKeyboardPair,
  saveCachedKeyboardPair,
} from "@/lib/demo/yamaha/keyboard-cache"
import { decodePayload7, startsWithBytes, text } from "@/lib/demo/yamaha/protocol-utils"
import {
  detectProfile,
  KEYBOARD_PROFILES,
  profileFromUniversalIdentity,
} from "@/lib/demo/yamaha/profiles"

type MidiMessage = { data: Uint8Array }
type MidiInputLike = {
  id: string
  name?: string | null
  manufacturer?: string | null
  state: string
  onmidimessage: ((event: MidiMessage) => void) | null
  open(): Promise<void>
  close(): Promise<void>
}
type MidiOutputLike = {
  id: string
  name?: string | null
  manufacturer?: string | null
  state: string
  send(data: Uint8Array | number[], timestamp?: number): void
  open(): Promise<void>
  close(): Promise<void>
}
type MidiAccessLike = {
  inputs: Map<string, MidiInputLike>
  outputs: Map<string, MidiOutputLike>
  onstatechange: (() => void) | null
}

export type MidiPortChoice = {
  id: string
  name: string
  manufacturer: string
  state: string
}

export type MidiSendTarget = "port1" | "port2" | "both"

/** Incoming MIDI from a Yamaha port pair. Clock/tempo follow Port 1 only. */
export type MidiMessageDetail = {
  data: Uint8Array
  port: 1 | 2
}

export type YamahaPortPair = {
  input1: MidiPortChoice
  output1: MidiPortChoice
  input2: MidiPortChoice
  output2: MidiPortChoice
}

export function isYamahaArrangerPort(
  port: Pick<MidiPortChoice, "name" | "manufacturer">,
  portNumber: 1 | 2,
): boolean {
  const identity = `${port.manufacturer} ${port.name}`
  if (/smartbridge/i.test(identity)) return false
  // Motif / MODX / Montage use a different connector path on desktop — never
  // treat them as the Genos/Tyros arranger USB pair (they also expose Port1/2).
  if (/motif|modx|montage|reface/i.test(identity)) return false
  // Desktop LocalMidiConnector matches Digital Keyboard / Digital Workstation;
  // also accept Genos/Tyros/PSR USB names seen in Chrome Web MIDI.
  if (
    !/yamaha|digital keyboard|digital workstation|genos|tyros|psr[- ]?s|psr[- ]?sx/i.test(
      identity,
    )
  ) {
    return false
  }
  const tag =
    portNumber === 1
      ? /(?:port\s*1(?!\d)|[-_]1|\b1)$/i
      : /(?:port\s*2(?!\d)|[-_]2|\b2)$/i
  return tag.test(port.name.trim())
}

/** Prefer true arranger USB names when Motif + Genos are both plugged in. */
function arrangerPortPriority(
  port: Pick<MidiPortChoice, "name" | "manufacturer">,
): number {
  const identity = `${port.manufacturer} ${port.name}`.toLowerCase()
  if (/digital keyboard|digital workstation/.test(identity)) return 0
  if (/genos|tyros/.test(identity)) return 1
  if (/psr/.test(identity)) return 2
  return 3
}

function pickArrangerPort(
  ports: MidiPortChoice[],
  portNumber: 1 | 2,
): MidiPortChoice | undefined {
  return ports
    .filter((port) => isYamahaArrangerPort(port, portNumber))
    .sort(
      (a, b) =>
        arrangerPortPriority(a) - arrangerPortPriority(b) ||
        a.name.localeCompare(b.name),
    )[0]
}

/** @deprecated Prefer isYamahaArrangerPort(port, 2). Kept for older tests. */
export function isYamahaMidiPort2(port: Pick<MidiPortChoice, "name" | "manufacturer">): boolean {
  return isYamahaArrangerPort(port, 2)
}

export function findYamahaPortPair(
  inputs: MidiPortChoice[],
  outputs: MidiPortChoice[],
): YamahaPortPair | null {
  const input1 = pickArrangerPort(inputs, 1)
  const input2 = pickArrangerPort(inputs, 2)
  const output1 = pickArrangerPort(outputs, 1)
  const output2 = pickArrangerPort(outputs, 2)
  if (!input1 || !input2 || !output1 || !output2) return null
  return { input1, input2, output1, output2 }
}

export type MidiSessionSnapshot = {
  supported: boolean
  secure: boolean
  connected: boolean
  connecting: boolean
  inputName: string
  outputName: string
  modelName: string
  profile: KeyboardProfile | null
  error: string
  inputs: MidiPortChoice[]
  outputs: MidiPortChoice[]
}

type PendingResponse = {
  matcher: (data: Uint8Array) => boolean
  resolve: (data: Uint8Array) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const initialSnapshot = (): MidiSessionSnapshot => ({
  supported: typeof navigator !== "undefined" && "requestMIDIAccess" in navigator,
  secure: typeof window !== "undefined" && window.isSecureContext,
  connected: false,
  connecting: false,
  inputName: "",
  outputName: "",
  modelName: "",
  profile: null,
  error: "",
  inputs: [],
  outputs: [],
})

export class YamahaMidiSession extends EventTarget {
  private access: MidiAccessLike | null = null
  private input1: MidiInputLike | null = null
  private input2: MidiInputLike | null = null
  private output1: MidiOutputLike | null = null
  private output2: MidiOutputLike | null = null
  private pending = new Set<PendingResponse>()
  private snapshot: MidiSessionSnapshot = initialSnapshot()
  /** Ignore port-state disconnect storms while a connect attempt is in flight. */
  private ignoreDisconnectUntil = 0

  get state(): MidiSessionSnapshot {
    return this.snapshot
  }

  private publish(update: Partial<MidiSessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...update }
    this.dispatchEvent(new CustomEvent("statechange", { detail: this.snapshot }))
  }

  async requestAccess(modelId?: YamahaModelId): Promise<MidiSessionSnapshot> {
    if (!this.snapshot.supported) {
      this.publish({ error: "Web MIDI is not available. Use Chrome or Edge on desktop." })
      return this.snapshot
    }
    if (!this.snapshot.secure) {
      this.publish({ error: "Keyboard access requires HTTPS or localhost." })
      return this.snapshot
    }

    const chosenProfile = modelId ? KEYBOARD_PROFILES[modelId] : this.snapshot.profile
    this.ignoreDisconnectUntil = Date.now() + 2500
    // Fresh reconnect: close any half-open ports before requesting access again.
    if (this.snapshot.connected || this.input1 || this.output1) {
      await this.disconnect("", { preserveProfile: true })
    }
    this.publish({
      connecting: true,
      error: "",
      profile: chosenProfile || this.snapshot.profile,
      modelName:
        chosenProfile?.displayName ||
        this.snapshot.profile?.displayName ||
        this.snapshot.modelName,
    })
    try {
      const request = (
        navigator as Navigator & {
          requestMIDIAccess(options: { sysex: boolean }): Promise<MidiAccessLike>
        }
      ).requestMIDIAccess
      this.access = await request.call(navigator, { sysex: true })
      this.access.onstatechange = () => {
        this.refreshPorts()
        if (Date.now() < this.ignoreDisconnectUntil || this.snapshot.connecting) return
        const ports = [this.input1, this.input2, this.output1, this.output2]
        if (ports.some((port) => port && port.state !== "connected")) {
          void this.disconnect("Keyboard disconnected.", { preserveProfile: true })
        }
      }
      this.refreshPorts()
      const cached = loadCachedKeyboardPair()
      const cachedPair = cached
        ? resolveCachedKeyboardPair(
            cached,
            this.snapshot.inputs,
            this.snapshot.outputs,
          )
        : null
      // Drop stale Motif / non-arranger cache so Genos wins when both are present.
      const cachedIsArranger =
        !!cachedPair &&
        isYamahaArrangerPort(cachedPair.input1, 1) &&
        isYamahaArrangerPort(cachedPair.input2, 2) &&
        isYamahaArrangerPort(cachedPair.output1, 1) &&
        isYamahaArrangerPort(cachedPair.output2, 2)
      if (cached && !cachedIsArranger) {
        clearCachedKeyboardPair()
      }
      if (cached?.modelId && KEYBOARD_PROFILES[cached.modelId] && !chosenProfile) {
        this.publish({
          profile: KEYBOARD_PROFILES[cached.modelId],
          modelName: cached.modelName || KEYBOARD_PROFILES[cached.modelId].displayName,
        })
      }
      const pair =
        (cachedIsArranger ? cachedPair : null) ||
        findYamahaPortPair(this.snapshot.inputs, this.snapshot.outputs)
      if (pair) {
        await this.connectPair(pair)
      } else {
        const portNames = [
          ...this.snapshot.inputs.map((port) => `in:${port.name}`),
          ...this.snapshot.outputs.map((port) => `out:${port.name}`),
        ]
        const seen = portNames.length ? ` Seen: ${portNames.join(", ")}.` : ""
        this.publish({
          connecting: false,
          error:
            "Keyboard not found. Plug in USB, power on the arranger, allow MIDI/SysEx in Chrome, then try again." +
            seen,
        })
      }
    } catch (error) {
      this.publish({
        connecting: false,
        error:
          error instanceof Error
            ? error.message
            : "SysEx permission was denied or the keyboard could not be opened.",
      })
    }
    return this.snapshot
  }

  /** Override catalog model (voices/styles) without reconnecting. */
  setKeyboardModel(modelId: YamahaModelId): void {
    const profile = KEYBOARD_PROFILES[modelId]
    if (!profile) return
    this.publish({
      profile,
      modelName: profile.displayName,
      error: "",
    })
    const cached = loadCachedKeyboardPair()
    if (cached) {
      saveCachedKeyboardPair(
        {
          input1: { id: cached.input1Id, name: cached.input1Name, manufacturer: "", state: "connected" },
          input2: { id: cached.input2Id, name: cached.input2Name, manufacturer: "", state: "connected" },
          output1: { id: cached.output1Id, name: cached.output1Name, manufacturer: "", state: "connected" },
          output2: { id: cached.output2Id, name: cached.output2Name, manufacturer: "", state: "connected" },
        },
        { modelId, modelName: profile.displayName },
      )
    }
  }

  private refreshPorts() {
    if (!this.access) return
    const toChoice = (port: MidiInputLike | MidiOutputLike): MidiPortChoice => ({
      id: port.id,
      name: port.name || "Unnamed MIDI port",
      manufacturer: port.manufacturer || "",
      state: port.state,
    })
    this.publish({
      inputs: Array.from(this.access.inputs.values()).map(toChoice),
      outputs: Array.from(this.access.outputs.values()).map(toChoice),
    })
  }

  async connectPair(pair: YamahaPortPair): Promise<MidiSessionSnapshot> {
    if (!this.access) await this.requestAccess()
    const input1 = this.access?.inputs.get(pair.input1.id)
    const input2 = this.access?.inputs.get(pair.input2.id)
    const output1 = this.access?.outputs.get(pair.output1.id)
    const output2 = this.access?.outputs.get(pair.output2.id)
    if (!input1 || !input2 || !output1 || !output2) {
      this.publish({
        connecting: false,
        error: "Keyboard not found. Check the USB cable and try again.",
      })
      return this.snapshot
    }

    this.publish({ connecting: true, error: "" })
    try {
      await Promise.all([input1.open(), input2.open(), output1.open(), output2.open()])
      this.input1 = input1
      this.input2 = input2
      this.output1 = output1
      this.output2 = output2
      this.input1.onmidimessage = (event: MidiMessage) => this.handleMessage(event.data, 1)
      this.input2.onmidimessage = (event: MidiMessage) => this.handleMessage(event.data, 2)
      this.publish({
        connected: true,
        connecting: false,
        inputName: `${input1.name} + ${input2.name}`,
        outputName: `${output1.name} + ${output2.name}`,
      })
      if (!this.snapshot.profile) await this.detectKeyboard()
      saveCachedKeyboardPair(pair, {
        modelId: this.snapshot.profile?.id ?? null,
        modelName: this.snapshot.modelName || this.snapshot.profile?.displayName,
      })
    } catch (error) {
      this.publish({
        connected: false,
        connecting: false,
        error: error instanceof Error ? error.message : "Could not open the MIDI ports.",
      })
    }
    return this.snapshot
  }

  /** Legacy single-port entry: if either port is chosen, open the full Yamaha pair. */
  async connect(inputId: string, outputId: string): Promise<MidiSessionSnapshot> {
    this.refreshPorts()
    const pair = findYamahaPortPair(this.snapshot.inputs, this.snapshot.outputs)
    if (pair) return this.connectPair(pair)
    this.publish({
      connecting: false,
      error: "Keyboard not found. Check the USB cable and try again.",
    })
    return this.snapshot
  }

  async detectKeyboard(): Promise<KeyboardProfile | null> {
    try {
      const identity = await this.request(
        Uint8Array.from([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]),
        (data) => startsWithBytes(data, [0xf0, 0x7e]) && data[3] === 0x06 && data[4] === 0x02,
        5000,
        "both",
      )
      const profile = profileFromUniversalIdentity(identity)
      if (profile) {
        this.publish({
          modelName: profile.displayName,
          profile,
          error: "",
        })
        return profile
      }
    } catch {
      // SmartBridge's file-transfer model query below is the proven fallback.
    }

    try {
      // Musicsoft model query must go Port 1 only (desktop YamahaStyleFileTransfer).
      const response = await this.request(
        Uint8Array.from([0xf0, 0x43, 0x50, 0x00, 0x00, 0x07, 0x01, 0xf7]),
        (data) => startsWithBytes(data, [0xf0, 0x43, 0x50, 0x00, 0x00, 0x07, 0x02]),
        3500,
        "port1",
      )
      const modelName = text(decodePayload7(response.slice(8, -1)))
      const profile = detectProfile(modelName)
      this.publish({
        modelName,
        profile,
        error: profile
          ? ""
          : `Connected to unsupported Yamaha model: ${modelName || "unknown"}.`,
      })
      return profile
    } catch {
      this.publish({
        modelName: "",
        profile: null,
        error:
          "Both Yamaha ports are open, but the keyboard did not answer SmartBridge identity or Musicsoft model requests.",
      })
      return null
    }
  }

  send(data: Uint8Array, timestamp?: number, target: MidiSendTarget = "both") {
    if (!this.snapshot.connected || (!this.output1 && !this.output2)) {
      throw new Error("Connect the keyboard before sending MIDI.")
    }
    // Clone per port — some Web MIDI stacks share/queue the same buffer.
    if (target === "port1" || target === "both") {
      this.output1?.send(Uint8Array.from(data), timestamp)
    }
    if (target === "port2" || target === "both") {
      this.output2?.send(Uint8Array.from(data), timestamp)
    }
  }

  sendPort1(data: Uint8Array, timestamp?: number) {
    this.send(data, timestamp, "port1")
  }

  sendPort2(data: Uint8Array, timestamp?: number) {
    this.send(data, timestamp, "port2")
  }

  sendBoth(data: Uint8Array, timestamp?: number) {
    this.send(data, timestamp, "both")
  }

  request(
    data: Uint8Array,
    matcher: (response: Uint8Array) => boolean,
    timeoutMs = 3000,
    target: MidiSendTarget = "port1",
  ): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const pending: PendingResponse = {
        matcher,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.pending.delete(pending)
          reject(new Error("Timed out waiting for the keyboard response."))
        }, timeoutMs),
      }
      this.pending.add(pending)
      try {
        this.send(data, undefined, target)
      } catch (error) {
        clearTimeout(pending.timer)
        this.pending.delete(pending)
        reject(error)
      }
    })
  }

  private handleMessage(data: Uint8Array, port: 1 | 2) {
    this.dispatchEvent(
      new CustomEvent("midimessage", { detail: { data, port } satisfies MidiMessageDetail }),
    )
    for (const pending of this.pending) {
      if (!pending.matcher(data)) continue
      clearTimeout(pending.timer)
      this.pending.delete(pending)
      pending.resolve(data)
      break
    }
  }

  panic() {
    for (let channel = 0; channel < 16; channel += 1) {
      const message = Uint8Array.of(0xb0 | channel, 123, 0)
      this.output1?.send(message)
      this.output2?.send(message)
    }
  }

  async disconnect(
    reason = "",
    options?: { preserveProfile?: boolean },
  ) {
    this.pending.forEach((pending) => {
      clearTimeout(pending.timer)
      pending.reject(new Error(reason || "MIDI session closed."))
    })
    this.pending.clear()
    this.panic()
    if (this.input1) this.input1.onmidimessage = null
    if (this.input2) this.input2.onmidimessage = null
    await Promise.allSettled(
      [this.input1?.close(), this.input2?.close(), this.output1?.close(), this.output2?.close()].filter(
        Boolean,
      ),
    )
    this.input1 = null
    this.input2 = null
    this.output1 = null
    this.output2 = null
    this.publish({
      connected: false,
      connecting: false,
      inputName: "",
      outputName: "",
      ...(options?.preserveProfile
        ? {}
        : { modelName: "", profile: null }),
      error: reason,
    })
  }
}

let sharedSession: YamahaMidiSession | null = null

export function getMidiSession(): YamahaMidiSession {
  if (!sharedSession) sharedSession = new YamahaMidiSession()
  return sharedSession
}
