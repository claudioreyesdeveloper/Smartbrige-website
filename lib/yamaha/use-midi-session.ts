"use client"

import { useEffect, useState } from "react"
import {
  getMidiSession,
  type MidiSessionSnapshot,
  type YamahaMidiSession,
} from "@/lib/yamaha/midi-session"

export function useMidiSession(): [YamahaMidiSession, MidiSessionSnapshot] {
  const [session] = useState(getMidiSession)
  const [snapshot, setSnapshot] = useState(session.state)

  useEffect(() => {
    const update = (event: Event) => {
      setSnapshot((event as CustomEvent<MidiSessionSnapshot>).detail)
    }
    session.addEventListener("statechange", update)
    setSnapshot(session.state)
    return () => session.removeEventListener("statechange", update)
  }, [session])

  return [session, snapshot]
}
