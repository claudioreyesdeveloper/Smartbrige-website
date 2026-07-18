"use client"

import { Plug, ShieldCheck, Unplug } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import {
  getPreferredKeyboardModel,
  setKeyboardAutoConnect,
  setPreferredKeyboardModel,
} from "@/lib/yamaha/preferred-model"
import { KEYBOARD_PROFILES } from "@/lib/yamaha/profiles"
import { useKeyboardAutoConnect } from "@/lib/yamaha/use-keyboard-auto-connect"
import { useMidiSession } from "@/lib/yamaha/use-midi-session"
import type { YamahaModelId } from "@/lib/yamaha/types"

const MODEL_OPTIONS = ["genos", "genos2", "tyros4", "tyros5"] as const satisfies readonly YamahaModelId[]

/**
 * Global keyboard controls in the app shell — one model + connection for every paid feature.
 * Preferred model + auto-connect intent are stored in localStorage.
 *
 * Browser-only bits (Web MIDI support, saved model) apply after mount so SSR HTML
 * matches the first client paint.
 */
export function AppKeyboardBar() {
  const [session, midi] = useMidiSession()
  const [model, setModel] = useState<YamahaModelId | null>(null)
  const [mounted, setMounted] = useState(false)
  useKeyboardAutoConnect()

  useEffect(() => {
    setMounted(true)
    setModel(getPreferredKeyboardModel() ?? null)
  }, [])

  useEffect(() => {
    if (midi.profile?.id) setModel(midi.profile.id)
  }, [midi.profile?.id])

  useEffect(() => {
    if (midi.connected) setKeyboardAutoConnect(true)
  }, [midi.connected])

  const selectModel = (id: YamahaModelId) => {
    setModel(id)
    setPreferredKeyboardModel(id)
  }

  const connect = async () => {
    if (!model) return
    setPreferredKeyboardModel(model)
    setKeyboardAutoConnect(true)
    await session.requestAccess(model)
  }

  const disconnect = async () => {
    setKeyboardAutoConnect(false)
    await session.disconnect()
  }

  const showConnected = mounted && midi.connected
  const connectDisabled = !mounted || !model || midi.connecting || !midi.supported
  const connectLabel = !mounted
    ? "Choose model"
    : midi.connecting
      ? "Connecting…"
      : model
        ? "Connect my keyboard"
        : "Choose model"

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
            className={mounted && model === id ? "is-selected" : ""}
            aria-pressed={mounted && model === id}
            disabled={!mounted || midi.connecting}
            onClick={() => selectModel(id)}
          >
            {KEYBOARD_PROFILES[id].displayName}
          </button>
        ))}
      </div>

      {showConnected ? (
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
          disabled={connectDisabled}
          onClick={() => void connect()}
        >
          <Plug size={14} aria-hidden="true" />
          {connectLabel}
        </button>
      )}

      <Link href="/app/settings" className="app-keyboard-bar-link">
        Settings
      </Link>

      {mounted && midi.error ? (
        <p className="app-keyboard-bar-error" role="alert">
          {midi.error}
        </p>
      ) : null}
    </div>
  )
}
