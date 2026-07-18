import { MixerEngine } from "@/lib/mixer/engine"
import type { MixerClock, MixerPort } from "@/lib/mixer/types"
import type { YamahaModelId } from "@/lib/yamaha/types"
import type { YamahaMidiSession } from "@/lib/yamaha/midi-session"

export class ProductionMixerSession {
  readonly engine: MixerEngine

  private readonly onSessionState = () => {
    this.engine.setConnected(this.session.state.connected)
  }

  private readonly onMidiMessage = (event: Event) => {
    const detail = (event as CustomEvent<Uint8Array>).detail
    this.engine.handleMidi(detail, null)
  }

  constructor(
    private readonly session: YamahaMidiSession,
    model: YamahaModelId,
    clock?: MixerClock,
    refreshTimeoutMs?: number,
  ) {
    this.engine = new MixerEngine(session, model, clock, refreshTimeoutMs)
    this.engine.setConnected(session.state.connected)
    session.addEventListener("statechange", this.onSessionState)
    session.addEventListener("midimessage", this.onMidiMessage)
  }

  handlePortMessage(port: MixerPort, data: Uint8Array): boolean {
    return this.engine.handleMidi(data, port)
  }

  dispose(): void {
    this.session.removeEventListener("statechange", this.onSessionState)
    this.session.removeEventListener("midimessage", this.onMidiMessage)
    this.engine.setConnected(false)
  }
}
