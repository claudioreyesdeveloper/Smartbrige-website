import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getKeyboardAutoConnect,
  getPreferredKeyboardModel,
  setKeyboardAutoConnect,
  setPreferredKeyboardModel,
} from "@/lib/yamaha/preferred-model"
import { YamahaMidiSession } from "@/lib/yamaha/midi-session"

const MEMORY = new Map<string, string>()

function installMemoryStorage() {
  MEMORY.clear()
  const storage = {
    getItem: (key: string) => MEMORY.get(key) ?? null,
    setItem: (key: string, value: string) => {
      MEMORY.set(key, String(value))
    },
    removeItem: (key: string) => {
      MEMORY.delete(key)
    },
  }
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  })
}

describe("keyboard persistence helpers", () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  afterEach(() => {
    MEMORY.clear()
  })

  it("stores preferred model and auto-connect intent", () => {
    expect(getPreferredKeyboardModel()).toBeNull()
    expect(getKeyboardAutoConnect()).toBe(false)

    setPreferredKeyboardModel("genos2")
    setKeyboardAutoConnect(true)

    expect(getPreferredKeyboardModel()).toBe("genos2")
    expect(getKeyboardAutoConnect()).toBe(true)

    setKeyboardAutoConnect(false)
    expect(getKeyboardAutoConnect()).toBe(false)
  })
})

describe("YamahaMidiSession.requestAccess already connected", () => {
  it("does not reopen ports when the session is already connected", async () => {
    const session = new YamahaMidiSession()
    const open = vi.fn(async () => undefined)
    const close = vi.fn(async () => undefined)
    const send = vi.fn()
    const makePort = (id: string, name: string) => ({
      id,
      name,
      manufacturer: "Yamaha",
      state: "connected",
      onmidimessage: null as ((event: { data: Uint8Array }) => void) | null,
      open,
      close,
      send,
      sent: [] as Uint8Array[],
    })

    const input1 = makePort("i1", "Digital Keyboard Port 1")
    const input2 = makePort("i2", "Digital Keyboard Port 2")
    const output1 = makePort("o1", "Digital Keyboard Port 1")
    const output2 = makePort("o2", "Digital Keyboard Port 2")

    Object.assign(session as object, {
      access: {
        inputs: new Map([
          [input1.id, input1],
          [input2.id, input2],
        ]),
        outputs: new Map([
          [output1.id, output1],
          [output2.id, output2],
        ]),
        onstatechange: null,
      },
      input1,
      input2,
      output1,
      output2,
    })
    ;(session as unknown as { publish(update: Record<string, unknown>): void }).publish({
      supported: true,
      secure: true,
      connected: true,
      connecting: false,
      profile: { id: "genos", displayName: "Genos" },
      modelName: "Genos",
      error: "",
    })

    const requestMIDIAccess = vi.fn()
    vi.stubGlobal("navigator", { requestMIDIAccess })

    const result = await session.requestAccess("genos2")
    expect(result.connected).toBe(true)
    expect(result.profile?.id).toBe("genos2")
    expect(result.connecting).toBe(false)
    expect(open).not.toHaveBeenCalled()
    expect(requestMIDIAccess).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})
