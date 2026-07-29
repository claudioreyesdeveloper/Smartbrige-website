import {
  ARRANGER_PARTS,
  ARRANGER_SECTION_ROLES,
  type StyleArrangerState,
} from "@/lib/band-jam/engine/style-arranger"

const STORAGE_KEY = "smartbridge.jam-player.style-arranger.v1"

type StoredArrangers = Record<string, unknown>

function canStore(): boolean {
  return typeof window !== "undefined" && !!window.localStorage
}

function readStore(): StoredArrangers {
  if (!canStore()) return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")
    return parsed && typeof parsed === "object" ? (parsed as StoredArrangers) : {}
  } catch {
    return {}
  }
}

function cloneState(state: StyleArrangerState): StyleArrangerState {
  return state.map((variation) =>
    Object.fromEntries(
      ARRANGER_SECTION_ROLES.map((role) => [
        role,
        { ...variation[role] },
      ]),
    ) as StyleArrangerState[number],
  )
}

export function loadStyleArranger(
  styleId: string,
  fallback: StyleArrangerState,
): StyleArrangerState {
  const saved = readStore()[styleId]
  const next = cloneState(fallback)
  if (!Array.isArray(saved)) return next

  for (let variation = 0; variation < next.length; variation += 1) {
    const storedVariation = saved[variation]
    if (!storedVariation || typeof storedVariation !== "object") continue
    for (const role of ARRANGER_SECTION_ROLES) {
      const storedRole = (storedVariation as Record<string, unknown>)[role]
      if (!storedRole || typeof storedRole !== "object") continue
      for (const part of ARRANGER_PARTS) {
        const value = (storedRole as Record<string, unknown>)[part]
        if (typeof value === "boolean") next[variation][role][part] = value
      }
    }
  }
  return next
}

/** Save only when the Arranger's dedicated Save button is pressed. */
export function saveStyleArranger(
  styleId: string,
  state: StyleArrangerState,
): void {
  if (!canStore() || !styleId) return
  const store = readStore()
  store[styleId] = cloneState(state)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function clearStyleArranger(styleId: string): void {
  if (!canStore() || !styleId) return
  const store = readStore()
  delete store[styleId]
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export const STYLE_ARRANGER_STORAGE_KEY = STORAGE_KEY
