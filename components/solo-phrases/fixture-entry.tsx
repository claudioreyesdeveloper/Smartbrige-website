"use client"

import { useRef } from "react"
import { createDeterministicSoloPhrasesAdapters } from "./fakes"
import { SoloPhrasesWorkspace } from "./solo-phrases-workspace"
import type { SoloPhrasesAdapters } from "./types"

/** Test-only composition root enabled by SMARTBRIDGE_ACCESS_FIXTURE. */
export function SoloPhrasesFixtureEntry() {
  const adapters = useRef<SoloPhrasesAdapters>(
    createDeterministicSoloPhrasesAdapters(),
  )
  return <SoloPhrasesWorkspace adapters={adapters.current} />
}
