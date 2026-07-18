"use client"

import { Plug, ShieldCheck, Unplug } from "lucide-react"
import { useEffect, useState } from "react"
import { KEYBOARD_PROFILES } from "@/lib/yamaha/profiles"
import {
  getPreferredKeyboardModel,
  setPreferredKeyboardModel,
} from "@/lib/yamaha/preferred-model"
import { useMidiSession } from "@/lib/yamaha/use-midi-session"
import type { YamahaModelId } from "@/lib/yamaha/types"

const MODEL_OPTIONS = ["genos", "genos2", "tyros4", "tyros5"] as const satisfies readonly YamahaModelId[]

type KeyboardSetupPanelProps = {
  /** When true, hide the large setup block once connected (status stays in compact bar). */
  compactWhenConnected?: boolean
  onSafeStop?: () => void
}

/**
 * Same connect flow as Demo Station: pick Genos/Tyros model, then Connect my keyboard.
 * Uses the production Web MIDI session (shared across paid /app services).
 */
export function KeyboardSetupPanel({
  compactWhenConnected = false,
  onSafeStop,
}: KeyboardSetupPanelProps) {
  const [session, midi] = useMidiSession()
  const [model, setModel] = useState<YamahaModelId | null>(null)

  useEffect(() => {
    setModel(getPreferredKeyboardModel() ?? midi.profile?.id ?? null)
  }, [midi.profile?.id])

  const selectModel = (id: YamahaModelId) => {
    setModel(id)
    setPreferredKeyboardModel(id)
  }

  const connect = async () => {
    if (!model) return
    setPreferredKeyboardModel(model)
    await session.requestAccess(model)
  }

  const disconnect = async () => {
    onSafeStop?.()
    await session.disconnect()
  }

  if (midi.connected && compactWhenConnected) {
    return (
      <div className="paid-keyboard-status is-connected" role="status" aria-label="Keyboard connection">
        <ShieldCheck size={16} aria-hidden="true" />
        <strong>{midi.profile?.displayName || midi.modelName || "Yamaha"}</strong>
        <button type="button" className="paid-keyboard-action" onClick={() => void disconnect()}>
          <Unplug size={16} aria-hidden="true" />
          Disconnect
        </button>
      </div>
    )
  }

  if (midi.connected) {
    return (
      <div className="paid-keyboard-connected" role="status" aria-label="Keyboard connection">
        <div>
          <span className="paid-jam-step-label">1 · Keyboard connection</span>
          <strong>{midi.profile?.displayName || midi.modelName || "Yamaha"}</strong>
          <p>Keyboard is connected and ready.</p>
        </div>
        <button type="button" onClick={() => void disconnect()}>
          <Unplug size={16} aria-hidden="true" />
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <section className="paid-keyboard-setup keyboard-setup" aria-labelledby="paid-keyboard-setup-title">
      <div className="guided-step-number">1</div>
      <div className="keyboard-setup-copy">
        <span className="demo-eyebrow">First, choose your keyboard</span>
        <h2 id="paid-keyboard-setup-title">Which Yamaha keyboard do you have?</h2>
        <p>
          Turn it on and connect it with a USB cable. This connection is shared by every SmartBridge
          feature.
        </p>
      </div>
      <div className="keyboard-model-grid">
        {MODEL_OPTIONS.map((id) => (
          <button
            key={id}
            type="button"
            className={model === id ? "is-selected" : ""}
            onClick={() => selectModel(id)}
            aria-pressed={model === id}
          >
            <span className="selection-light" />
            {KEYBOARD_PROFILES[id].displayName}
          </button>
        ))}
      </div>
      <button
        className="senior-primary-action"
        type="button"
        disabled={!model || midi.connecting || !midi.supported || !midi.secure}
        onClick={() => void connect()}
      >
        <Plug size={24} aria-hidden="true" />
        {midi.connecting ? "Connecting…" : "Connect my keyboard"}
      </button>
      {midi.error ? (
        <p className="paid-keyboard-error" role="alert">
          {midi.error}
        </p>
      ) : null}
      {!midi.supported ? (
        <p className="paid-keyboard-error" role="alert">
          Use Chrome or Edge desktop. Safari does not support Web MIDI.
        </p>
      ) : null}
      {midi.supported && !midi.secure ? (
        <p className="paid-keyboard-error" role="alert">
          Keyboard access requires HTTPS or localhost.
        </p>
      ) : null}
    </section>
  )
}
