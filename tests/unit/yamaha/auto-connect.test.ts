import { describe, expect, it } from "vitest"
import {
  getKeyboardAutoConnect,
  getPreferredKeyboardModel,
  setKeyboardAutoConnect,
  setPreferredKeyboardModel,
} from "@/lib/yamaha/preferred-model"

const MEMORY = new Map<string, string>()

function installMemoryStorage() {
  MEMORY.clear()
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => MEMORY.get(key) ?? null,
      setItem: (key: string, value: string) => {
        MEMORY.set(key, String(value))
      },
      removeItem: (key: string) => {
        MEMORY.delete(key)
      },
    },
  })
}

/** Pure decision used by useKeyboardAutoConnect — kept testable without React. */
function shouldAutoConnect(options: {
  alreadyAttempted: boolean
  connected: boolean
  connecting: boolean
}): boolean {
  if (options.alreadyAttempted) return false
  if (options.connected || options.connecting) return false
  if (!getKeyboardAutoConnect()) return false
  return getPreferredKeyboardModel() != null
}

describe("keyboard auto-connect decision", () => {
  it("connects once when preferred model + auto-connect are set and disconnected", () => {
    installMemoryStorage()
    setPreferredKeyboardModel("genos")
    setKeyboardAutoConnect(true)

    expect(
      shouldAutoConnect({ alreadyAttempted: false, connected: false, connecting: false }),
    ).toBe(true)
  })

  it("skips when already connected or connecting", () => {
    installMemoryStorage()
    setPreferredKeyboardModel("genos")
    setKeyboardAutoConnect(true)

    expect(
      shouldAutoConnect({ alreadyAttempted: false, connected: true, connecting: false }),
    ).toBe(false)
    expect(
      shouldAutoConnect({ alreadyAttempted: false, connected: false, connecting: true }),
    ).toBe(false)
  })

  it("skips after Disconnect clears auto-connect", () => {
    installMemoryStorage()
    setPreferredKeyboardModel("genos")
    setKeyboardAutoConnect(true)
    setKeyboardAutoConnect(false)

    expect(
      shouldAutoConnect({ alreadyAttempted: false, connected: false, connecting: false }),
    ).toBe(false)
  })

  it("skips a second attempt in the same page load", () => {
    installMemoryStorage()
    setPreferredKeyboardModel("genos")
    setKeyboardAutoConnect(true)

    expect(
      shouldAutoConnect({ alreadyAttempted: true, connected: false, connecting: false }),
    ).toBe(false)
  })
})
