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
 * Compact app-shell keyboard controls — shared MIDI session for all paid services.
 * Full setup also lives on each workspace; this keeps connection visible like desktop Settings.
 */
export function AppKeyboardBar() {
  const [session, midi] = useMidiSession()
  const [model, setModel] = useState<YamahaModelId | null>(null)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    setModel(getPreferredKeyboardModel() ?? midi.profile?.id ?? null)
  }, [midi.profile?.id])

  const connect = async () => {
    if (!model) {
      setPicking(true)
      return
    }
    setPreferredKeyboardModel(model)
    setPicking(false)
    await session.requestAccess(model)
  }

  if (midi.connected) {
    return (
      <div className="app-keyboard-bar is-connected" role="status" aria-label="Keyboard">
        <ShieldCheck size={14} aria-hidden="true" />
        <span>{midi.profile?.displayName || midi.modelName || "Yamaha"}</span>
        <button
          type="button"
          className="app-keyboard-bar-button"
          onClick={() => void session.disconnect()}
        >
          <Unplug size={14} aria-hidden="true" />
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="app-keyboard-bar" aria-label="Keyboard">
      {(picking || !model) && (
        <div className="app-keyboard-bar-models" role="group" aria-label="Keyboard model">
          {MODEL_OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              className={model === id ? "is-selected" : ""}
              aria-pressed={model === id}
              onClick={() => {
                setModel(id)
                setPreferredKeyboardModel(id)
              }}
            >
              {KEYBOARD_PROFILES[id].displayName}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="app-keyboard-bar-button is-primary"
        disabled={midi.connecting || !midi.supported}
        onClick={() => void connect()}
      >
        <Plug size={14} aria-hidden="true" />
        {midi.connecting
          ? "Connecting…"
          : model
            ? "Connect my keyboard"
            : "Choose keyboard"}
      </button>
      <Link href="/app/jam-player" className="app-keyboard-bar-link">
        Setup help
      </Link>
    </div>
  )
}
