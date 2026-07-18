import type { KeyboardProfile } from "@/lib/demo/types"
import { decodePayload7, startsWithBytes, text } from "@/lib/demo/yamaha/protocol-utils"
import {
  detectProfile,
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

export function isYamahaMidiPort2(port: Pick<MidiPortChoice, "name" | "manufacturer">): boolean {
  const identity = `${port.manufacturer} ${port.name}`
  return (
    /yamaha|digital keyboard|genos|tyros/i.test(identity) &&
    /(?:port\s*2|[- ]2)$/i.test(port.name) &&
    !/smartbridge/i.test(identity)
  )
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
  private input: MidiInputLike | null = null
  private output: MidiOutputLike | null = null
  private pending = new Set<PendingResponse>()
  private snapshot: MidiSessionSnapshot = initialSnapshot()

  get state(): MidiSessionSnapshot {
    return this.snapshot
  }

  private publish(update: Partial<MidiSessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...update }
    this.dispatchEvent(new CustomEvent("statechange", { detail: this.snapshot }))
  }

  async requestAccess(): Promise<MidiSessionSnapshot> {
    if (!this.snapshot.supported) {
      this.publish({ error: "Web MIDI is not available. Use Chrome or Edge on desktop." })
      return this.snapshot
    }
    if (!this.snapshot.secure) {
      this.publish({ error: "Keyboard access requires HTTPS or localhost." })
      return this.snapshot
    }

    this.publish({ connecting: true, error: "" })
    try {
      const request = (
        navigator as Navigator & {
          requestMIDIAccess(options: { sysex: boolean }): Promise<MidiAccessLike>
        }
      ).requestMIDIAccess
      this.access = await request.call(navigator, { sysex: true })
      this.access.onstatechange = () => {
        this.refreshPorts()
        if (this.input?.state !== "connected" || this.output?.state !== "connected") {
          void this.disconnect("Keyboard disconnected.")
        }
      }
      this.refreshPorts()

      if (
        this.snapshot.inputs.length === 1 &&
        this.snapshot.outputs.length === 1 &&
        isYamahaMidiPort2(this.snapshot.inputs[0]) &&
        isYamahaMidiPort2(this.snapshot.outputs[0])
      ) {
        await this.connect(this.snapshot.inputs[0].id, this.snapshot.outputs[0].id)
      } else {
        this.publish({ connecting: false })
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

  async connect(inputId: string, outputId: string): Promise<MidiSessionSnapshot> {
    if (!this.access) await this.requestAccess()
    const input = this.access?.inputs.get(inputId)
    const output = this.access?.outputs.get(outputId)
    if (!input || !output) {
      this.publish({ connecting: false, error: "Select both a Yamaha MIDI input and output." })
      return this.snapshot
    }
    if (!isYamahaMidiPort2({
      name: input.name || "",
      manufacturer: input.manufacturer || "",
    }) || !isYamahaMidiPort2({
      name: output.name || "",
      manufacturer: output.manufacturer || "",
    })) {
      this.publish({
        connecting: false,
        error: "SmartBridge requires Yamaha USB MIDI Port 2 for both input and output.",
      })
      return this.snapshot
    }

    this.publish({ connecting: true, error: "" })
    try {
      await Promise.all([input.open(), output.open()])
      this.input = input
      this.output = output
      this.input.onmidimessage = (event) => this.handleMessage(event.data)
      this.publish({
        connected: true,
        connecting: false,
        inputName: input.name || "Yamaha input",
        outputName: output.name || "Yamaha output",
      })
      await this.detectKeyboard()
    } catch (error) {
      this.publish({
        connected: false,
        connecting: false,
        error: error instanceof Error ? error.message : "Could not open the MIDI ports.",
      })
    }
    return this.snapshot
  }

  async detectKeyboard(): Promise<KeyboardProfile | null> {
    try {
      const identity = await this.request(
        Uint8Array.from([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]),
        (data) => startsWithBytes(data, [0xf0, 0x7e]) && data[3] === 0x06 && data[4] === 0x02,
        1200,
      )
      const universalProfile = profileFromUniversalIdentity(identity)
      if (universalProfile) {
        this.publish({
          modelName: universalProfile.displayName,
          profile: universalProfile,
          error: "",
        })
        return universalProfile
      }
    } catch {
      // Older Tyros firmware may only answer the Musicsoft model query below.
    }

    try {
      const response = await this.request(
        Uint8Array.from([0xf0, 0x43, 0x50, 0x00, 0x00, 0x07, 0x01, 0xf7]),
        (data) => startsWithBytes(data, [0xf0, 0x43, 0x50, 0x00, 0x00, 0x07, 0x02]),
        3500,
      )
      const modelName = text(decodePayload7(response.slice(8, -1)))
      const profile = detectProfile(modelName)
      this.publish({
        modelName,
        profile,
        error: profile ? "" : `Connected to ${modelName || "Yamaha"}, but this model is not supported.`,
      })
      return profile
    } catch {
      this.publish({
        modelName: "",
        profile: null,
        error: "Connected, but the Yamaha model did not answer the identity request.",
      })
      return null
    }
  }

  send(data: Uint8Array, timestamp?: number) {
    if (!this.output || !this.snapshot.connected) {
      throw new Error("Connect the keyboard before sending MIDI.")
    }
    this.output.send(data, timestamp)
  }

  request(
    data: Uint8Array,
    matcher: (response: Uint8Array) => boolean,
    timeoutMs = 3000,
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
        this.send(data)
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

  panic() {
    if (!this.output) return
    for (let channel = 0; channel < 16; channel += 1) {
      this.output.send(Uint8Array.of(0xb0 | channel, 123, 0))
    }
  }

  async disconnect(reason = "") {
    this.pending.forEach((pending) => {
      clearTimeout(pending.timer)
      pending.reject(new Error(reason || "MIDI session closed."))
    })
    this.pending.clear()
    this.panic()
    if (this.input) this.input.onmidimessage = null
    await Promise.allSettled([this.input?.close(), this.output?.close()].filter(Boolean))
    this.input = null
    this.output = null
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
