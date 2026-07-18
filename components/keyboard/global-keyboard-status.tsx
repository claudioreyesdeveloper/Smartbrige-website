"use client"

import Link from "next/link"
import { ShieldCheck, TriangleAlert } from "lucide-react"
import { useMidiSession } from "@/lib/yamaha/use-midi-session"

/**
 * Read-only connection status for feature workspaces.
 * Connect / model pick live only in the app shell and /app/settings.
 */
export function GlobalKeyboardStatus() {
  const [, midi] = useMidiSession()

  if (midi.connected) {
    return (
      <div className="paid-keyboard-status is-connected" role="status" aria-label="Keyboard connection">
        <ShieldCheck size={16} aria-hidden="true" />
        <div>
          <span className="paid-jam-step-label">Keyboard · shared for all features</span>
          <strong>{midi.profile?.displayName || midi.modelName || "Yamaha"}</strong>
          <p>Connected from the header or Settings. This same keyboard is used in every workspace.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`paid-keyboard-status is-disconnected${midi.error ? " has-error" : ""}`}
      role="status"
      aria-label="Keyboard connection"
    >
      <div>
        <span className="paid-jam-step-label">Keyboard · shared for all features</span>
        <strong>{midi.connecting ? "Connecting…" : "Keyboard not connected"}</strong>
        {midi.error ? (
          <p className="paid-keyboard-status-error" role="alert">
            <TriangleAlert size={14} aria-hidden="true" /> {midi.error}
          </p>
        ) : (
          <p>
            Choose Genos / Tyros, then click <strong>Connect my keyboard</strong> in the header
            (or use <Link href="/app/settings">Settings</Link>). USB plugged in is not enough
            until Connect succeeds.
          </p>
        )}
      </div>
    </div>
  )
}
