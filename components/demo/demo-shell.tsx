"use client"

import Link from "next/link"
import { ChevronLeft, CircleHelp, Plug, ShieldCheck, Unplug } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import type { YamahaModelId } from "@/lib/demo/types"
import { KEYBOARD_PROFILES } from "@/lib/demo/yamaha/profiles"
import { useMidiSession } from "@/lib/demo/yamaha/use-midi-session"
import { BrowserCompatibility } from "@/components/demo/browser-compatibility"

type DemoShellProps = {
  title: string
  eyebrow: string
  step: string
  children: ReactNode
  onSafeStop?: () => void
}

export function DemoShell({
  title,
  eyebrow,
  step,
  children,
  onSafeStop,
}: DemoShellProps) {
  const [session, midi] = useMidiSession()
  const [model, setModel] = useState<YamahaModelId | null>(null)

  const requestConnection = async () => {
    if (model) await session.requestAccess(model)
  }

  const disconnect = async () => {
    onSafeStop?.()
    await session.disconnect()
  }

  return (
    <BrowserCompatibility>
    <div className={`demo-app${midi.connected ? "" : " senior-demo"}`}>
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
              disabled={midi.connecting || !model}
            >
              <Plug size={16} />
              {midi.connecting ? "Connecting…" : model ? "Connect my keyboard" : "Choose keyboard below"}
            </button>
          )}
        </div>
      </header>

      {!midi.connected && (
        <section className="keyboard-setup" aria-labelledby="keyboard-setup-title">
          <div className="guided-step-number">1</div>
          <div className="keyboard-setup-copy">
            <span className="demo-eyebrow">First, choose your keyboard</span>
            <h1 id="keyboard-setup-title">Which Yamaha keyboard do you have?</h1>
            <p>Turn it on and connect it to this computer with a USB cable.</p>
          </div>
          <div className="keyboard-model-grid">
            {(["genos", "genos2", "tyros4", "tyros5"] as YamahaModelId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={model === id ? "is-selected" : ""}
                onClick={() => setModel(id)}
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
            disabled={!model || midi.connecting}
            onClick={requestConnection}
          >
            <Plug size={24} />
            {midi.connecting ? "Connecting…" : "Connect my keyboard"}
          </button>
        </section>
      )}

      {midi.error && <div className="demo-status is-error" role="status">{midi.error}</div>}
      {!midi.supported && (
        <div className="demo-status is-error">Use Chrome or Edge desktop. Safari does not support Web MIDI.</div>
      )}

      {midi.connected && <main className="demo-workspace">{children}</main>}
    </div>
    </BrowserCompatibility>
  )
}
