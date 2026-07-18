import type {
  KeyboardProfile,
  MidiPortChoice,
  MidiSendTarget,
  MidiSessionSnapshot,
  YamahaModelId,
  YamahaPortPair,
} from "@/lib/yamaha/types"
import { findYamahaPortPair } from "@/lib/yamaha/ports"
import { decodePayload7, startsWithBytes, text } from "@/lib/yamaha/protocol-utils"
import {
  detectProfile,
  isMusicsoftModelReply,
  isUniversalIdentityReply,
  KEYBOARD_PROFILES,
  MUSICSOFT_MODEL_REQUEST,
  profileFromUniversalIdentity,
  UNIVERSAL_IDENTITY_REQUEST,
} from "@/lib/yamaha/profiles"

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

export type { MidiPortChoice, MidiSendTarget, YamahaPortPair, MidiSessionSnapshot }

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
    this.publish({
      connecting: true,
      error: "",
      profile: chosenProfile,
      modelName: chosenProfile?.displayName || this.snapshot.modelName,
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
        const ports = [this.input1, this.input2, this.output1, this.output2]
        if (ports.some((port) => port && port.state !== "connected")) {
          void this.disconnect("Keyboard disconnected.")
        }
      }
      this.refreshPorts()
      const pair = findYamahaPortPair(this.snapshot.inputs, this.snapshot.outputs)
      if (pair) {
        await this.connectPair(pair)
      } else {
        this.publish({
          connecting: false,
          error: "Keyboard not found. Check the USB cable, turn the keyboard on, and try again.",
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
      const onMessage = (event: MidiMessage) => this.handleMessage(event.data)
      this.input1.onmidimessage = onMessage
      this.input2.onmidimessage = onMessage
      this.publish({
        connected: true,
        connecting: false,
        inputName: `${input1.name} + ${input2.name}`,
        outputName: `${output1.name} + ${output2.name}`,
      })
      if (!this.snapshot.profile) await this.detectKeyboard()
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
  async connect(_inputId: string, _outputId: string): Promise<MidiSessionSnapshot> {
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
        UNIVERSAL_IDENTITY_REQUEST,
        isUniversalIdentityReply,
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
      // Musicsoft model query below is the proven fallback (YamahaStyleFileTransfer).
    }

    try {
      const response = await this.request(
        MUSICSOFT_MODEL_REQUEST,
        isMusicsoftModelReply,
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
    if (target === "port1" || target === "both") this.output1?.send(data, timestamp)
    if (target === "port2" || target === "both") this.output2?.send(data, timestamp)
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

  private handleMessage(data: Uint8Array) {
    this.dispatchEvent(new CustomEvent("midimessage", { detail: data }))
    for (const pending of this.pending) {
      if (!pending.matcher(data)) continue
      clearTimeout(pending.timer)
      this.pending.delete(pending)
      pending.resolve(data)
      break
    }
  }

  /** All Notes Off (CC 123) on every channel, both ports. */
  panic() {
    for (let channel = 0; channel < 16; channel += 1) {
      const message = Uint8Array.of(0xb0 | channel, 123, 0)
      this.output1?.send(message)
      this.output2?.send(message)
    }
  }

  async disconnect(reason = "") {
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
      modelName: "",
      profile: null,
      error: reason,
    })
  }
}

let sharedSession: YamahaMidiSession | null = null

export function getMidiSession(): YamahaMidiSession {
  if (!sharedSession) sharedSession = new YamahaMidiSession()
  return sharedSession
}

export function resetMidiSessionSingleton(forTesting = false): void {
  if (forTesting) sharedSession = null
}

export { findYamahaPortPair, isYamahaArrangerPort, isYamahaMidiPort2 } from "@/lib/yamaha/ports"
