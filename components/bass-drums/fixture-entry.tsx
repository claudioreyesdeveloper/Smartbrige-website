"use client"

import { useRef } from "react"
import { BassDrumsWorkspace } from "./bass-drums-workspace"
import { createDeterministicBassDrumsAdapters } from "./fakes"
import type { BassDrumsAdapters } from "./types"

/**
 * Temporary composition root for A23. The workspace itself requires injected
 * adapters, so private engine/proxy integration can replace this fixture
 * without changing UI state or making fake adapters a production default.
 */
export function BassDrumsFixtureEntry() {
  const adapters = useRef<BassDrumsAdapters>(createDeterministicBassDrumsAdapters())
  return <BassDrumsWorkspace adapters={adapters.current} />
}
