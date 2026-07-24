/**
 * Style Maker named-project encode/decode for cloud API + local draft.
 * Binaries travel as base64; payload holds non-binary workspace fields.
 */

import type { AuditionChannelMap } from "@/lib/style-maker/audition"
import type { VoiceSelectionMap } from "@/lib/style-maker/audition-voice"
import {
  StyleMakerGuitarCasmMode,
  StyleMakerLane,
} from "@/lib/style-maker/lanes"
import type { PartMixerMap } from "@/lib/style-maker/part-mixer"
import type {
  SectionAssignmentMap,
  StyleMakerWorkspaceSnapshot,
} from "@/lib/style-maker/workspace-cache"
import { normalizeWorkspaceSnapshot } from "@/lib/style-maker/workspace-cache"

/** Soft limit for donor / built style blobs (plan: 8 MB). */
export const STYLE_MAKER_PROJECT_MAX_BYTES = 8 * 1024 * 1024

export type StyleMakerProjectPayload = {
  version: 2
  sectionName: string
  bars: number
  sectionBars?: Record<string, number>
  includeCC: boolean
  selectedLane: StyleMakerLane
  libTab: "bass" | "drums" | "guitar" | "brass"
  sectionAssignments: Record<string, SectionAssignmentMap>
  sectionMinorAssignments?: Record<string, SectionAssignmentMap>
  guitarCasmModes: Partial<Record<StyleMakerLane, StyleMakerGuitarCasmMode>>
  sectionGuitarCasmModes?: Record<
    string,
    Partial<Record<StyleMakerLane, StyleMakerGuitarCasmMode>>
  >
  auditionChannels: AuditionChannelMap
  voiceSelection: VoiceSelectionMap
  partMixers?: Record<string, PartMixerMap>
}

export type StyleMakerProjectListItem = {
  id: string
  name: string
  donorFileName: string
  updatedAt: string
}

export type StyleMakerProjectWire = {
  id: string
  name: string
  donorFileName: string
  donorBytesBase64: string
  lastBuiltFileName?: string | null
  lastBuiltBytesBase64?: string | null
  payload: StyleMakerProjectPayload
  createdAt?: string
  updatedAt?: string
}

export type StyleMakerProjectWriteBody = {
  name: string
  donorFileName: string
  donorBytesBase64: string
  lastBuiltFileName?: string | null
  lastBuiltBytesBase64?: string | null
  payload: StyleMakerProjectPayload
}

export function sanitizeProjectName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ")
  return trimmed.slice(0, 120)
}

export function assertProjectName(raw: string): string {
  const name = sanitizeProjectName(raw)
  if (!name) throw new Error("Project name is required.")
  return name
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64")
  }
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(value: string): Uint8Array {
  if (!value) return new Uint8Array()
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"))
  }
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

export function assertByteSize(label: string, bytes: Uint8Array): void {
  if (bytes.length > STYLE_MAKER_PROJECT_MAX_BYTES) {
    throw new Error(
      `${label} exceeds ${STYLE_MAKER_PROJECT_MAX_BYTES / (1024 * 1024)} MB limit.`,
    )
  }
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = (error as { code?: string }).code
  if (code === "23505") return true
  const message = String((error as { message?: string }).message || "")
  return (
    message.includes("style_maker_projects_user_name_idx") ||
    message.toLowerCase().includes("unique")
  )
}

export function payloadFromSnapshot(
  snapshot: StyleMakerWorkspaceSnapshot,
): StyleMakerProjectPayload {
  const normalized = normalizeWorkspaceSnapshot(snapshot)
  if (!normalized) throw new Error("Invalid workspace snapshot.")
  return {
    version: 2,
    sectionName: normalized.sectionName,
    bars: normalized.bars,
    sectionBars: normalized.sectionBars || {},
    includeCC: normalized.includeCC,
    selectedLane: normalized.selectedLane,
    libTab: normalized.libTab,
    sectionAssignments: normalized.sectionAssignments || {},
    sectionMinorAssignments: normalized.sectionMinorAssignments || {},
    guitarCasmModes: normalized.guitarCasmModes || {},
    sectionGuitarCasmModes: normalized.sectionGuitarCasmModes || {},
    auditionChannels: normalized.auditionChannels,
    voiceSelection: normalized.voiceSelection,
    partMixers: normalized.partMixers || {},
  }
}

export function snapshotFromProjectWire(
  project: StyleMakerProjectWire,
): StyleMakerWorkspaceSnapshot {
  const donorBytes = base64ToBytes(project.donorBytesBase64)
  if (!donorBytes.length) throw new Error("Project is missing donor style bytes.")
  const lastBuiltBytes = project.lastBuiltBytesBase64
    ? base64ToBytes(project.lastBuiltBytesBase64)
    : undefined
  const payload = project.payload
  return (
    normalizeWorkspaceSnapshot({
      version: 2,
      savedAt: Date.now(),
      donorFileName: project.donorFileName,
      donorBytes,
      sectionName: payload.sectionName,
      bars: payload.bars,
      sectionBars: payload.sectionBars || {},
      includeCC: payload.includeCC,
      selectedLane: payload.selectedLane,
      libTab: payload.libTab,
      sectionAssignments: payload.sectionAssignments || {},
      sectionMinorAssignments: payload.sectionMinorAssignments || {},
      guitarCasmModes: payload.guitarCasmModes || {},
      sectionGuitarCasmModes: payload.sectionGuitarCasmModes || {},
      auditionChannels: payload.auditionChannels,
      voiceSelection: payload.voiceSelection,
      partMixers: payload.partMixers || {},
      lastBuiltFileName: project.lastBuiltFileName || undefined,
      lastBuiltBytes,
    }) || {
      version: 2,
      savedAt: Date.now(),
      donorFileName: project.donorFileName,
      donorBytes,
      sectionName: payload.sectionName || "Main A",
      bars: payload.bars || 2,
      sectionBars: payload.sectionBars || {},
      includeCC: !!payload.includeCC,
      selectedLane: payload.selectedLane ?? StyleMakerLane.Rhythm1,
      libTab: payload.libTab || "bass",
      sectionAssignments: payload.sectionAssignments || {},
      sectionMinorAssignments: payload.sectionMinorAssignments || {},
      guitarCasmModes: payload.guitarCasmModes || {},
      sectionGuitarCasmModes: payload.sectionGuitarCasmModes || {},
      auditionChannels: payload.auditionChannels,
      voiceSelection: payload.voiceSelection,
      partMixers: payload.partMixers || {},
      lastBuiltFileName: project.lastBuiltFileName || undefined,
      lastBuiltBytes,
    }
  )
}

export function writeBodyFromSnapshot(
  name: string,
  snapshot: StyleMakerWorkspaceSnapshot,
): StyleMakerProjectWriteBody {
  const donorBytes =
    snapshot.donorBytes instanceof Uint8Array
      ? snapshot.donorBytes
      : new Uint8Array(snapshot.donorBytes)
  assertByteSize("Donor style", donorBytes)
  const lastBuilt =
    snapshot.lastBuiltBytes instanceof Uint8Array
      ? snapshot.lastBuiltBytes
      : snapshot.lastBuiltBytes
        ? new Uint8Array(snapshot.lastBuiltBytes)
        : undefined
  if (lastBuilt) assertByteSize("Built style", lastBuilt)
  return {
    name: assertProjectName(name),
    donorFileName: snapshot.donorFileName,
    donorBytesBase64: bytesToBase64(donorBytes),
    lastBuiltFileName: snapshot.lastBuiltFileName ?? null,
    lastBuiltBytesBase64: lastBuilt ? bytesToBase64(lastBuilt) : null,
    payload: payloadFromSnapshot(snapshot),
  }
}

export function parseWriteBody(raw: unknown): StyleMakerProjectWriteBody {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid project body.")
  }
  const body = raw as Record<string, unknown>
  const name = assertProjectName(String(body.name || ""))
  const donorFileName = String(body.donorFileName || "").trim()
  if (!donorFileName) throw new Error("donorFileName is required.")
  const donorBytesBase64 = String(body.donorBytesBase64 || "")
  if (!donorBytesBase64) throw new Error("donorBytesBase64 is required.")
  const donorBytes = base64ToBytes(donorBytesBase64)
  if (!donorBytes.length) throw new Error("Donor style bytes are empty.")
  assertByteSize("Donor style", donorBytes)

  let lastBuiltBytesBase64: string | null = null
  if (body.lastBuiltBytesBase64) {
    lastBuiltBytesBase64 = String(body.lastBuiltBytesBase64)
    assertByteSize("Built style", base64ToBytes(lastBuiltBytesBase64))
  }

  const payload = body.payload as StyleMakerProjectPayload | undefined
  if (!payload || typeof payload !== "object") {
    throw new Error("payload is required.")
  }
  if (payload.version !== 2) {
    throw new Error("payload.version must be 2.")
  }
  if (!payload.sectionName || typeof payload.sectionName !== "string") {
    throw new Error("payload.sectionName is required.")
  }

  return {
    name,
    donorFileName,
    donorBytesBase64,
    lastBuiltFileName: body.lastBuiltFileName
      ? String(body.lastBuiltFileName)
      : null,
    lastBuiltBytesBase64,
    payload: {
      version: 2,
      sectionName: payload.sectionName,
      bars: Number(payload.bars) || 2,
      includeCC: !!payload.includeCC,
      selectedLane: payload.selectedLane ?? StyleMakerLane.Rhythm1,
      libTab: payload.libTab || "bass",
      sectionAssignments: payload.sectionAssignments || {},
      sectionMinorAssignments: payload.sectionMinorAssignments || {},
      guitarCasmModes: payload.guitarCasmModes || {},
      auditionChannels: payload.auditionChannels,
      voiceSelection: payload.voiceSelection,
      partMixers: payload.partMixers || {},
    },
  }
}

export function newProjectId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `smp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function projectRowToWire(row: {
  id: string
  name: string
  donorFileName: string
  donorBytes: Buffer | Uint8Array
  lastBuiltFileName: string | null
  lastBuiltBytes: Buffer | Uint8Array | null
  payload: unknown
  createdAt: Date
  updatedAt: Date
}): StyleMakerProjectWire {
  const donor =
    row.donorBytes instanceof Uint8Array
      ? row.donorBytes
      : new Uint8Array(row.donorBytes)
  const built = row.lastBuiltBytes
    ? row.lastBuiltBytes instanceof Uint8Array
      ? row.lastBuiltBytes
      : new Uint8Array(row.lastBuiltBytes)
    : null
  return {
    id: row.id,
    name: row.name,
    donorFileName: row.donorFileName,
    donorBytesBase64: bytesToBase64(donor),
    lastBuiltFileName: row.lastBuiltFileName,
    lastBuiltBytesBase64: built ? bytesToBase64(built) : null,
    payload: row.payload as StyleMakerProjectPayload,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
