"use client"

import { useRef } from "react"
import { createDeterministicLyricsAdapters } from "./fakes"
import { LyricsWorkspace } from "./lyrics-workspace"
import type { LyricsAdapters } from "./types"

export function LyricsFixtureEntry() {
  const adapters = useRef<LyricsAdapters>(createDeterministicLyricsAdapters())
  return <LyricsWorkspace adapters={adapters.current} />
}
