"use client"

import { Plug, ShieldCheck, Unplug } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import {
  getPreferredKeyboardModel,
  setPreferredKeyboardModel,
} from "@/lib/yamaha/preferred-model"
import { KEYBOARD_PROFILES } from "@/lib/yamaha/profiles"
import { useMidiSession } from "@/lib/yamaha/use-midi-session"
import type { YamahaModelId } from "@/lib/yamaha/types"

const MODEL_OPTIONS = ["genos", "genos2", "tyros4", "tyros5"] as const satisfies readonly YamahaModelId[]

/**
 * Global keyboard controls in the app shell — one model + connection for every paid feature.
 * Preferred model is stored in localStorage (browser stand-in for desktop keyboard_model_key).
 */
export function AppKeyboardBar() {
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
    await session.disconnect()
  }

  return (
    <div className="app-keyboard-bar" aria-label="Keyboard for all features">
      <div className="app-keyboard-bar-label">
        <span>Keyboard</span>
        <small>All features</small>
      </div>

      <div className="app-keyboard-bar-models" role="group" aria-label="Keyboard model">
        {MODEL_OPTIONS.map((id) => (
          <button
            key={id}
            type="button"
            className={model === id ? "is-selected" : ""}
            aria-pressed={model === id}
            disabled={midi.connecting}
            onClick={() => selectModel(id)}
          >
            {KEYBOARD_PROFILES[id].displayName}
          </button>
        ))}
      </div>

      {midi.connected ? (
        <div className="app-keyboard-bar-status is-connected" role="status">
          <ShieldCheck size={14} aria-hidden="true" />
          <span>{midi.profile?.displayName || midi.modelName || "Connected"}</span>
          <button type="button" className="app-keyboard-bar-button" onClick={() => void disconnect()}>
            <Unplug size={14} aria-hidden="true" />
            Disconnect
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="app-keyboard-bar-button is-primary"
          disabled={!model || midi.connecting || !midi.supported}
          onClick={() => void connect()}
        >
          <Plug size={14} aria-hidden="true" />
          {midi.connecting ? "Connecting…" : model ? "Connect my keyboard" : "Choose model"}
        </button>
      )}

      <Link href="/app/settings" className="app-keyboard-bar-link">
        Settings
      </Link>

      {midi.error ? (
        <p className="app-keyboard-bar-error" role="alert">
          {midi.error}
        </p>
      ) : null}
    </div>
  )
}
