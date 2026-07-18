"use client"

import { KeyboardSetupPanel } from "@/components/keyboard/keyboard-setup-panel"

/** Desktop Settings equivalent: pick keyboard model and connect once for the whole app. */
export function SettingsWorkspace() {
  return (
    <div className="app-settings-workspace">
      <section className="app-settings-card" aria-labelledby="app-settings-keyboard-title">
        <div>
          <p className="app-shell-topbar-eyebrow">Global setting</p>
          <h2 id="app-settings-keyboard-title">Keyboard</h2>
          <p>
            Pick your Yamaha model and connect once. Jam Player, Bass &amp; Drums, Solo, Lyrics,
            and Genos Mixer all share this connection.
          </p>
          <p className="app-settings-note">
            Your preferred model is saved in this browser (same idea as desktop SmartBridge
            keyboard settings).
          </p>
        </div>

        <KeyboardSetupPanel />
      </section>
    </div>
  )
}
