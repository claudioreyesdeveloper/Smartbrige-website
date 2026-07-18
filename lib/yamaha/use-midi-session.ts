"use client"

import { useEffect, useState } from "react"
import {
  getMidiSession,
  type MidiSessionSnapshot,
  type YamahaMidiSession,
} from "@/lib/yamaha/midi-session"

/** Stable across SSR + first client render to avoid hydration mismatches. */
const SSR_SAFE_SNAPSHOT: MidiSessionSnapshot = {
  supported: false,
  secure: false,
  connected: false,
  connecting: false,
  inputName: "",
  outputName: "",
  modelName: "",
  profile: null,
  error: "",
  inputs: [],
  outputs: [],
}

export function useMidiSession(): [YamahaMidiSession, MidiSessionSnapshot] {
  const [session] = useState(getMidiSession)
  const [snapshot, setSnapshot] = useState<MidiSessionSnapshot>(SSR_SAFE_SNAPSHOT)

  useEffect(() => {
    session.hydrateEnvironment()
    setSnapshot(session.state)
    const update = (event: Event) => {
      setSnapshot((event as CustomEvent<MidiSessionSnapshot>).detail)
    }
    session.addEventListener("statechange", update)
    return () => session.removeEventListener("statechange", update)
  }, [session])

  return [session, snapshot]
}
