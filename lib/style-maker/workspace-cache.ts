/**
 * Style Maker local draft cache (IndexedDB).
 *
 * Cloud named projects are the account source of truth. IndexedDB holds only
 * the open project's draft, keyed by userId + projectId (or "unsaved").
 *
 * Legacy key "current" is still readable for one-time migration prompts.
 */

import type { MidiNote } from "@/lib/demo/style-midi"
import type { AuditionChannelMap } from "@/lib/style-maker/audition"
import type { VoiceSelectionMap } from "@/lib/style-maker/audition-voice"
import {
  StyleMakerGuitarCasmMode,
  StyleMakerLane,
} from "@/lib/style-maker/lanes"
import type { PartMixerMap } from "@/lib/style-maker/part-mixer"

const DB_NAME = "smartbridge-style-maker"
const DB_VERSION = 2
const STORE = "workspace"
/** Legacy single-slot key (pre named-projects). */
export const LEGACY_WORKSPACE_KEY = "current"

export type CachedLaneAssignment = {
  title: string
  subtitle: string
  notes: MidiNote[]
  cycleTicks: number
  origin: "library" | "upload" | "template"
  clipId?: number
  sourceKind: string
  frozen: boolean
}

export type SectionAssignmentMap = Partial<
  Record<StyleMakerLane, CachedLaneAssignment>
>

export type StyleMakerWorkspaceSnapshot = {
  /** 1 = legacy global assignments; 2 = per-section maps. */
  version: 1 | 2
  savedAt: number
  donorFileName: string
  donorBytes: Uint8Array
  sectionName: string
  bars: number
  includeCC: boolean
  selectedLane: StyleMakerLane
  libTab: "bass" | "drums" | "guitar" | "brass"
  /**
   * Per-section major takes keyed by section display label
   * (StyleSectionRecipe::lanes).
   */
  sectionAssignments: Record<string, SectionAssignmentMap>
  /** Intro/Ending minor takes (StyleSectionRecipe::minorLanes). */
  sectionMinorAssignments?: Record<string, SectionAssignmentMap>
  /**
   * Legacy v1 fields — still written for the active section so older readers
   * can recover something; prefer sectionAssignments on load.
   */
  assignments?: SectionAssignmentMap
  minorAssignments?: SectionAssignmentMap
  guitarCasmModes: Partial<Record<StyleMakerLane, StyleMakerGuitarCasmMode>>
  auditionChannels: AuditionChannelMap
  voiceSelection: VoiceSelectionMap
  /**
   * Saved Style Part Mixer snapshots keyed by section display label
   * (StyleSectionRecipe::partMixer per section).
   */
  partMixers?: Record<string, PartMixerMap>
  /** Last explicitly saved / transferred style bytes (post lane replace). */
  lastBuiltFileName?: string
  lastBuiltBytes?: Uint8Array
  /** Open cloud project id when draft belongs to a named project. */
  cloudProjectId?: string | null
  cloudProjectName?: string | null
}

export type StyleMakerDraftKey = {
  userId: string
  projectId: string | null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available."))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () =>
      reject(request.error || new Error("Could not open Style Maker cache."))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
  })
}

function asBytes(raw: unknown): Uint8Array | undefined {
  if (!raw) return undefined
  if (raw instanceof Uint8Array) return raw
  return new Uint8Array(raw as ArrayBuffer)
}

export function draftStorageKey(key: StyleMakerDraftKey): string {
  const user = (key.userId || "anonymous").trim() || "anonymous"
  const project = (key.projectId || "unsaved").trim() || "unsaved"
  return `draft:${user}:${project}`
}

/**
 * Normalize v1 (global assignments) and v2 (per-section) into one shape.
 */
export function normalizeWorkspaceSnapshot(
  raw: StyleMakerWorkspaceSnapshot,
): StyleMakerWorkspaceSnapshot | null {
  if (!raw?.donorBytes) return null
  if (raw.version !== 1 && raw.version !== 2) return null

  const sectionKey = (raw.sectionName || "Main A").trim() || "Main A"
  let sectionAssignments = raw.sectionAssignments
  let sectionMinorAssignments = raw.sectionMinorAssignments

  if (!sectionAssignments || !Object.keys(sectionAssignments).length) {
    if (raw.assignments && Object.keys(raw.assignments).length) {
      sectionAssignments = { [sectionKey]: raw.assignments }
    } else {
      sectionAssignments = {}
    }
  }
  if (!sectionMinorAssignments || !Object.keys(sectionMinorAssignments).length) {
    if (raw.minorAssignments && Object.keys(raw.minorAssignments).length) {
      sectionMinorAssignments = { [sectionKey]: raw.minorAssignments }
    } else {
      sectionMinorAssignments = {}
    }
  }

  const active = sectionAssignments[sectionKey] || {}
  const activeMinor = sectionMinorAssignments[sectionKey] || {}

  return {
    ...raw,
    version: 2,
    donorBytes: asBytes(raw.donorBytes)!,
    lastBuiltBytes: asBytes(raw.lastBuiltBytes),
    sectionAssignments,
    sectionMinorAssignments,
    assignments: active,
    minorAssignments: activeMinor,
  }
}

async function getByKey(
  storageKey: string,
): Promise<StyleMakerWorkspaceSnapshot | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly")
      const req = tx.objectStore(STORE).get(storageKey)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const value = req.result as StyleMakerWorkspaceSnapshot | undefined
        if (!value) {
          resolve(null)
          return
        }
        resolve(normalizeWorkspaceSnapshot(value))
      }
      tx.oncomplete = () => db.close()
    })
  } catch {
    return null
  }
}

async function putByKey(
  storageKey: string,
  snapshot: StyleMakerWorkspaceSnapshot,
): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put(snapshot, storageKey)
  })
}

async function deleteByKey(storageKey: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).delete(storageKey)
    })
  } catch {
    /* ignore */
  }
}

/** Load local draft for the open project slot. */
export async function loadStyleMakerDraft(
  key: StyleMakerDraftKey,
): Promise<StyleMakerWorkspaceSnapshot | null> {
  return getByKey(draftStorageKey(key))
}

export async function saveStyleMakerDraft(
  key: StyleMakerDraftKey,
  snapshot: StyleMakerWorkspaceSnapshot,
): Promise<void> {
  await putByKey(draftStorageKey(key), {
    ...snapshot,
    cloudProjectId: key.projectId,
  })
}

export async function clearStyleMakerDraft(
  key: StyleMakerDraftKey,
): Promise<void> {
  await deleteByKey(draftStorageKey(key))
}

/** Legacy single-slot cache (pre named projects). */
export async function loadLegacyStyleMakerWorkspace(): Promise<StyleMakerWorkspaceSnapshot | null> {
  return getByKey(LEGACY_WORKSPACE_KEY)
}

export async function clearLegacyStyleMakerWorkspace(): Promise<void> {
  await deleteByKey(LEGACY_WORKSPACE_KEY)
}

/**
 * Back-compat aliases used by older call sites — map to unsaved anonymous draft
 * or legacy key. Prefer loadStyleMakerDraft / saveStyleMakerDraft.
 */
export async function loadStyleMakerWorkspace(): Promise<StyleMakerWorkspaceSnapshot | null> {
  const draft = await loadStyleMakerDraft({
    userId: "anonymous",
    projectId: null,
  })
  if (draft) return draft
  return loadLegacyStyleMakerWorkspace()
}

export async function saveStyleMakerWorkspace(
  snapshot: StyleMakerWorkspaceSnapshot,
): Promise<void> {
  await saveStyleMakerDraft(
    {
      userId: "anonymous",
      projectId: snapshot.cloudProjectId || null,
    },
    snapshot,
  )
}

export async function clearStyleMakerWorkspace(): Promise<void> {
  await clearStyleMakerDraft({ userId: "anonymous", projectId: null })
  await clearLegacyStyleMakerWorkspace()
}
