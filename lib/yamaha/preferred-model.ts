import type { YamahaModelId } from "@/lib/yamaha/types"

const STORAGE_KEY = "smartbridge.keyboard_model_key"
const VALID: ReadonlySet<string> = new Set(["genos", "genos2", "tyros4", "tyros5"])

/** Browser stand-in for desktop ConfigManager `keyboard_model_key`. */
export function getPreferredKeyboardModel(): YamahaModelId | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (value && VALID.has(value)) return value as YamahaModelId
  } catch {
    /* private mode / blocked storage */
  }
  return null
}

export function setPreferredKeyboardModel(model: YamahaModelId): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, model)
  } catch {
    /* ignore */
  }
}
