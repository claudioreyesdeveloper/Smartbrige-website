"use client"

import { useRef } from "react"
import { createDisplaySafeMixerFakes } from "./fakes"
import { GenosMixerWorkspace } from "./genos-mixer-workspace"
import type { GenosMixerAdapters } from "./types"

/**
 * Explicit A31 composition root. The injected fixture is display-safe and
 * cannot communicate with a keyboard; production transport is intentionally absent.
 */
export function GenosMixerFixtureEntry() {
  const adapters = useRef<GenosMixerAdapters>(createDisplaySafeMixerFakes())
  return <GenosMixerWorkspace adapters={adapters.current} />
}
