"use client"

import { useEffect, useRef } from "react"
import {
  getKeyboardAutoConnect,
  getPreferredKeyboardModel,
} from "@/lib/yamaha/preferred-model"
import { useMidiSession } from "@/lib/yamaha/use-midi-session"

/**
 * Once per page load: if the user previously connected and left auto-connect on,
 * reopen the Yamaha Web MIDI ports without requiring another button click.
 */
export function useKeyboardAutoConnect(): void {
  const [session, midi] = useMidiSession()
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    if (midi.connected || midi.connecting) return
    if (!getKeyboardAutoConnect()) return
    const preferred = getPreferredKeyboardModel()
    if (!preferred) return
    attempted.current = true
    void session.requestAccess(preferred)
  }, [session, midi.connected, midi.connecting])
}
