"use client"

import Link from "next/link"
import { ShieldCheck } from "lucide-react"
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
          <p>Connected from app Settings. This same keyboard is used in every workspace.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="paid-keyboard-status is-disconnected" role="status" aria-label="Keyboard connection">
      <div>
        <span className="paid-jam-step-label">Keyboard · shared for all features</span>
        <strong>Keyboard not connected</strong>
        <p>
          Choose Genos / Tyros and connect once in the header or{" "}
          <Link href="/app/settings">Settings</Link>. Every feature uses that connection.
        </p>
      </div>
    </div>
  )
}
