"use client"

import Link from "next/link"
import { ChevronLeft, CircleHelp, Plug, ShieldCheck, Unplug } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import {
  isYamahaMidiPort2,
  type MidiPortChoice,
} from "@/lib/demo/yamaha/midi-session"
import { useMidiSession } from "@/lib/demo/yamaha/use-midi-session"

type DemoShellProps = {
  title: string
  eyebrow: string
  step: string
  children: ReactNode
  onSafeStop?: () => void
}

function preferredYamahaPort2(ports: MidiPortChoice[]): string {
  const physical = ports.find(isYamahaMidiPort2)
  return physical?.id || ""
}

export function DemoShell({
  title,
  eyebrow,
  step,
  children,
  onSafeStop,
}: DemoShellProps) {
  const [session, midi] = useMidiSession()
  const [showPorts, setShowPorts] = useState(false)
  const [inputId, setInputId] = useState("")
  const [outputId, setOutputId] = useState("")

  const requestConnection = async () => {
    const state = await session.requestAccess()
    if (!state.connected && (state.inputs.length !== 1 || state.outputs.length !== 1)) {
      setInputId(preferredYamahaPort2(state.inputs))
      setOutputId(preferredYamahaPort2(state.outputs))
      setShowPorts(true)
    }
  }

  const disconnect = async () => {
    onSafeStop?.()
    await session.disconnect()
  }

  return (
    <div className="demo-app">
      <header className="demo-topbar">
        <div className="demo-topbar-left">
          <Link href="/demo" className="demo-back" aria-label="Back to Demo Station">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <span className="demo-eyebrow">{eyebrow}</span>
            <strong>{title}</strong>
          </div>
        </div>

        <div className="demo-topbar-actions">
          <span className="demo-step">{step}</span>
          <button className="demo-icon-button" type="button" aria-label="Demo help">
            <CircleHelp size={18} />
          </button>
          {midi.connected ? (
            <>
              <span className="keyboard-badge is-connected">
                <ShieldCheck size={15} />
                {midi.profile?.displayName || midi.modelName || "Yamaha"}
              </span>
              <button className="demo-connect-button is-connected" type="button" onClick={disconnect}>
                <Unplug size={16} />
                Disconnect
              </button>
            </>
          ) : (
            <button
              className="demo-connect-button"
              type="button"
              onClick={requestConnection}
              disabled={midi.connecting}
            >
              <Plug size={16} />
              {midi.connecting ? "Connecting…" : "Connect keyboard"}
            </button>
          )}
        </div>
      </header>

      {showPorts && !midi.connected && (
        <section className="port-picker" aria-label="Choose Yamaha MIDI ports">
          <div>
            <label htmlFor="midi-input">Keyboard input</label>
            <select id="midi-input" value={inputId} onChange={(event) => setInputId(event.target.value)}>
              <option value="">Choose input</option>
              {midi.inputs.map((port) => <option key={port.id} value={port.id}>{port.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="midi-output">Keyboard output</label>
            <select id="midi-output" value={outputId} onChange={(event) => setOutputId(event.target.value)}>
              <option value="">Choose output</option>
              {midi.outputs.map((port) => <option key={port.id} value={port.id}>{port.name}</option>)}
            </select>
          </div>
          <button
            className="btn-primary"
            type="button"
            disabled={!inputId || !outputId}
            onClick={() => session.connect(inputId, outputId).then(() => setShowPorts(false))}
          >
            Pair ports
          </button>
        </section>
      )}

      {midi.error && <div className="demo-status is-error" role="status">{midi.error}</div>}
      {!midi.supported && (
        <div className="demo-status is-error">Use Chrome or Edge desktop. Safari does not support Web MIDI.</div>
      )}

      <main className="demo-workspace">{children}</main>
    </div>
  )
}
