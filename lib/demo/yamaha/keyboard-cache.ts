/**
 * Persist the last successfully opened Yamaha Port 1/2 pair so Style Maker
 * (and other Web MIDI clients sharing getMidiSession) can reconnect without
 * re-picking ports.
 */

import type { YamahaModelId } from "@/lib/demo/types"
import type { MidiPortChoice, YamahaPortPair } from "@/lib/demo/yamaha/midi-session"

const STORAGE_KEY = "smartbridge.midi.keyboard-pair.v1"

export type CachedKeyboardPair = {
  input1Id: string
  input2Id: string
  output1Id: string
  output2Id: string
  input1Name: string
  input2Name: string
  output1Name: string
  output2Name: string
  modelId?: YamahaModelId | null
  modelName?: string
  savedAt: number
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function loadCachedKeyboardPair(): CachedKeyboardPair | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedKeyboardPair
    if (
      !parsed?.input1Id ||
      !parsed?.input2Id ||
      !parsed?.output1Id ||
      !parsed?.output2Id
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveCachedKeyboardPair(
  pair: YamahaPortPair,
  options?: { modelId?: YamahaModelId | null; modelName?: string },
): void {
  if (!canUseStorage()) return
  const payload: CachedKeyboardPair = {
    input1Id: pair.input1.id,
    input2Id: pair.input2.id,
    output1Id: pair.output1.id,
    output2Id: pair.output2.id,
    input1Name: pair.input1.name,
    input2Name: pair.input2.name,
    output1Name: pair.output1.name,
    output2Name: pair.output2.name,
    modelId: options?.modelId ?? null,
    modelName: options?.modelName,
    savedAt: Date.now(),
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function clearCachedKeyboardPair(): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function matchPort(
  ports: MidiPortChoice[],
  id: string,
  name: string,
): MidiPortChoice | undefined {
  return (
    ports.find((port) => port.id === id) ||
    ports.find((port) => port.name === name && port.state === "connected") ||
    ports.find((port) => port.name === name)
  )
}

/** Resolve a cached pair against the current Web MIDI port list. */
export function resolveCachedKeyboardPair(
  cached: CachedKeyboardPair,
  inputs: MidiPortChoice[],
  outputs: MidiPortChoice[],
): YamahaPortPair | null {
  const input1 = matchPort(inputs, cached.input1Id, cached.input1Name)
  const input2 = matchPort(inputs, cached.input2Id, cached.input2Name)
  const output1 = matchPort(outputs, cached.output1Id, cached.output1Name)
  const output2 = matchPort(outputs, cached.output2Id, cached.output2Name)
  if (!input1 || !input2 || !output1 || !output2) return null
  return { input1, input2, output1, output2 }
}
