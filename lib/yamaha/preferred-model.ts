import type { YamahaModelId } from "@/lib/yamaha/types"

const MODEL_KEY = "smartbridge.keyboard_model_key"
const AUTO_CONNECT_KEY = "smartbridge.keyboard_auto_connect"
const VALID: ReadonlySet<string> = new Set(["genos", "genos2", "tyros4", "tyros5"])

/** Browser stand-in for desktop ConfigManager `keyboard_model_key`. */
export function getPreferredKeyboardModel(): YamahaModelId | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(MODEL_KEY)
    if (value && VALID.has(value)) return value as YamahaModelId
  } catch {
    /* private mode / blocked storage */
  }
  return null
}

export function setPreferredKeyboardModel(model: YamahaModelId): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(MODEL_KEY, model)
  } catch {
    /* ignore */
  }
}

/** When true, AppKeyboardBar auto-reconnects on shell mount. */
export function getKeyboardAutoConnect(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(AUTO_CONNECT_KEY) === "1"
  } catch {
    return false
  }
}

export function setKeyboardAutoConnect(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    if (enabled) window.localStorage.setItem(AUTO_CONNECT_KEY, "1")
    else window.localStorage.removeItem(AUTO_CONNECT_KEY)
  } catch {
    /* ignore */
  }
}
