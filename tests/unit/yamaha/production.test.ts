import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ARRANGER_COMMANDS,
  chordNotes,
  fillCommand,
  mainCommand,
  styleSelectCommand,
  tempoCommand,
} from "@/lib/yamaha/commands"
import {
  MusicsoftTransfer,
  MUSICSOFT_CHUNK_SIZE,
} from "@/lib/yamaha/musicsoft-transfer"
import {
  findYamahaPortPair,
  isYamahaArrangerPort,
  isYamahaMidiPort2,
  resetMidiSessionSingleton,
  YamahaMidiSession,
} from "@/lib/yamaha/midi-session"
import {
  KEYBOARD_PROFILES,
  profileFromUniversalIdentity,
} from "@/lib/yamaha/profiles"
import {
  checksum7,
  decodePayload7,
  encodePayload7,
} from "@/lib/yamaha/protocol-utils"
import { createStylePreviewRegistration } from "@/lib/yamaha/registration"
import {
  styleMappingForEntry,
  stylesForProfile,
} from "@/lib/yamaha/style-catalog"
import {
  createPresetStyleSelectSysEx,
  fromNumeric14Bit,
  fromPackedWireBytes,
} from "@/lib/yamaha/style-selection"

type MockPort = {
  id: string
  name: string
  manufacturer: string
  state: string
  onmidimessage: ((event: { data: Uint8Array }) => void) | null
  sent: Uint8Array[]
  open: () => Promise<void>
  close: () => Promise<void>
  send: (data: Uint8Array | number[]) => void
}

function createMockPort(id: string, name: string, manufacturer = "Yamaha"): MockPort {
  const port: MockPort = {
    id,
    name,
    manufacturer,
    state: "connected",
    onmidimessage: null,
    sent: [],
    open: async () => {},
    close: async () => {},
    send(data) {
      port.sent.push(Uint8Array.from(data))
    },
  }
  return port
}

function wireConnectedSession(session: YamahaMidiSession) {
  const input1 = createMockPort("i1", "Digital Keyboard Port 1")
  const input2 = createMockPort("i2", "Digital Keyboard Port 2")
  const output1 = createMockPort("o1", "Digital Keyboard Port 1")
  const output2 = createMockPort("o2", "Digital Keyboard Port 2")

  const access = {
    inputs: new Map([
      [input1.id, input1],
      [input2.id, input2],
    ]),
    outputs: new Map([
      [output1.id, output1],
      [output2.id, output2],
    ]),
    onstatechange: null as (() => void) | null,
  }

  Object.assign(session as object, {
    access,
    input1,
    input2,
    output1,
    output2,
  })
  const onMessage = (event: { data: Uint8Array }) => {
    ;(session as unknown as { handleMessage(data: Uint8Array): void }).handleMessage(event.data)
  }
  input1.onmidimessage = onMessage
  input2.onmidimessage = onMessage
  session["publish"]({
    supported: true,
    secure: true,
    connected: true,
    connecting: false,
    inputName: `${input1.name} + ${input2.name}`,
    outputName: `${output1.name} + ${output2.name}`,
    inputs: [
      { id: input1.id, name: input1.name, manufacturer: input1.manufacturer, state: input1.state },
      { id: input2.id, name: input2.name, manufacturer: input2.manufacturer, state: input2.state },
    ],
    outputs: [
      { id: output1.id, name: output1.name, manufacturer: output1.manufacturer, state: output1.state },
      { id: output2.id, name: output2.name, manufacturer: output2.manufacturer, state: output2.state },
    ],
  })

  return { input1, input2, output1, output2 }
}

describe("lib/yamaha ports", () => {
  it("pairs Yamaha arranger Port 1 and Port 2", () => {
    expect(
      isYamahaArrangerPort({ name: "Digital Keyboard Port 1", manufacturer: "Yamaha Corporation" }, 1),
    ).toBe(true)
    expect(
      isYamahaArrangerPort({ name: "Digital Keyboard Port 2", manufacturer: "Yamaha Corporation" }, 2),
    ).toBe(true)
    expect(isYamahaMidiPort2({ name: "Digital Workstation-2", manufacturer: "Yamaha" })).toBe(true)
    expect(isYamahaMidiPort2({ name: "Digital Keyboard Port 1", manufacturer: "Yamaha Corporation" })).toBe(
      false,
    )
    expect(isYamahaArrangerPort({ name: "SmartBridge MIDI 2", manufacturer: "" }, 2)).toBe(false)

    const pair = findYamahaPortPair(
      [
        { id: "i1", name: "Digital Keyboard Port 1", manufacturer: "Yamaha", state: "connected" },
        { id: "i2", name: "Digital Keyboard Port 2", manufacturer: "Yamaha", state: "connected" },
      ],
      [
        { id: "o1", name: "Digital Keyboard Port 1", manufacturer: "Yamaha", state: "connected" },
        { id: "o2", name: "Digital Keyboard Port 2", manufacturer: "Yamaha", state: "connected" },
      ],
    )
    expect(pair?.input1.id).toBe("i1")
    expect(pair?.output2.id).toBe("o2")
  })
})

describe("lib/yamaha arranger commands", () => {
  it("matches JamPlayerScreen tempo/start/stop/main/fill bytes", () => {
    expect([...tempoCommand(120)]).toEqual([0xf0, 0x43, 0x7e, 0, 2, 9, 48, 0xf7])
    expect([...ARRANGER_COMMANDS.start]).toEqual([0xf0, 0x43, 0x60, 0x7a, 0xf7])
    expect([...ARRANGER_COMMANDS.intro1]).toEqual([0xf0, 0x43, 0x7e, 0, 0, 0x7f, 0xf7])
    expect([...mainCommand("D")]).toEqual([0xf0, 0x43, 0x7e, 0, 0x0b, 0x7f, 0xf7])
    expect([...fillCommand("B")]).toEqual([0xf0, 0x43, 0x7e, 0, 0x11, 0x7f, 0xf7])
  })

  it("uses model-scoped style select wire bytes", () => {
    expect([...styleSelectCommand(KEYBOARD_PROFILES.genos.styleMappings.Gospel)].slice(-3, -1)).toEqual([
      0x2b, 0x62,
    ])
    expect([...styleSelectCommand(KEYBOARD_PROFILES.tyros5.styleMappings.Gospel)].slice(-3, -1)).toEqual([
      0x15, 0x62,
    ])
  })

  it("builds lower-channel chord notes including slash bass", () => {
    expect(chordNotes("Cmaj7")).toEqual([36, 40, 43, 47])
    expect(chordNotes("G7/B")).toEqual([35, 43, 47, 50, 53])
  })
})

describe("lib/yamaha style selection", () => {
  it("matches YamahaStyleSelection.h regression vectors", () => {
    expect(fromNumeric14Bit(5635)).toEqual({ first: 0x2c, second: 0x03, valid: true })
    expect(fromPackedWireBytes(5635)).toEqual({ first: 0x16, second: 0x03, valid: true })
    expect(fromPackedWireBytes(5602)).toEqual({ first: 0x15, second: 0x62, valid: true })
    expect(fromNumeric14Bit(-1).valid).toBe(false)
    expect(fromPackedWireBytes(0x10000).valid).toBe(false)

    const genosSysEx = createPresetStyleSelectSysEx("genos", 5602)
    expect(genosSysEx && [...genosSysEx].slice(-3, -1)).toEqual([0x2b, 0x62])
  })

  it("encodes catalog entries per keyboard family", () => {
    expect(stylesForProfile(KEYBOARD_PROFILES.genos)).toHaveLength(550)
    expect(stylesForProfile(KEYBOARD_PROFILES.genos2)).toHaveLength(796)
    expect(stylesForProfile(KEYBOARD_PROFILES.tyros4)).toHaveLength(509)
    expect(stylesForProfile(KEYBOARD_PROFILES.tyros5)).toHaveLength(537)

    const genosStyle = { name: "Test", category: "Pop", bpm: 120, styleNumber: 5635 }
    const tyrosStyle = { ...genosStyle, styleNumber: 5602 }
    expect(styleMappingForEntry(KEYBOARD_PROFILES.genos, genosStyle).bytes).toEqual([0x2c, 0x03])
    expect(styleMappingForEntry(KEYBOARD_PROFILES.tyros5, tyrosStyle).bytes).toEqual([0x15, 0x62])
  })

  it("recognizes verified universal identity tuples", () => {
    expect(
      profileFromUniversalIdentity(
        Uint8Array.from([0xf0, 0x7e, 0x7f, 6, 2, 0x43, 0x7f, 0x68, 0, 0, 0xf7]),
      )?.id,
    ).toBe("genos2")
    expect(
      profileFromUniversalIdentity(
        Uint8Array.from([0xf0, 0x7e, 0x7f, 6, 2, 0x43, 0x7f, 0x7f, 0, 0, 0xf7]),
      )?.id,
    ).toBe("tyros5")
  })
})

describe("lib/yamaha protocol helpers", () => {
  it("round-trips eight-bit data through Yamaha 7-bit packing", () => {
    const source = Uint8Array.from([0, 1, 127, 128, 200, 255, 64, 129, 20])
    expect([...decodePayload7(encodePayload7(source))]).toEqual([...source])
  })

  it("matches the modulo-128 checksum rule", () => {
    const payload = Uint8Array.from([2, 2, 0, 127, 1])
    expect((payload.reduce((sum, byte) => sum + byte, 0) + checksum7(payload)) % 128).toBe(0)
  })
})

describe("lib/yamaha Musicsoft transfer", () => {
  it(`uploads ${MUSICSOFT_CHUNK_SIZE}-byte chunks with sequence and checksum`, async () => {
    const commands: Uint8Array[] = []
    const fakeSession = {
      request: async (command: Uint8Array) => {
        commands.push(command)
        return Uint8Array.from([0xf0, 0x43, 0x50, 0, 3, 0, 0xf7])
      },
    }
    const transfer = new MusicsoftTransfer(fakeSession as never)
    await transfer.uploadFile(
      "0:\\STYLE\\Demo.prs",
      Uint8Array.from({ length: 211 }, (_, index) => index & 0xff),
      [0, 100],
    )
    const packets = commands.filter((command) => command[1] === 0x43 && command[3] === 0x01)
    expect(packets).toHaveLength(2)
    expect(packets[0][8]).toBe(0)
    expect(packets[1][8]).toBe(1)
    packets.forEach((packet) => {
      const payload = packet.slice(6, -2)
      expect((payload.reduce((sum, byte) => sum + byte, 0) + packet.at(-2)!) % 128).toBe(0)
    })
    expect([...commands.at(-1)!]).toEqual([0xf0, 0x43, 0x50, 0, 3, 2, 0xf7])
  })
})

describe("lib/yamaha registration", () => {
  it("builds a YRGN bank pointing at a STYLE path", () => {
    const blob = createStylePreviewRegistration("0:\\STYLE\\Demo.prs")
    expect(new TextDecoder("latin1").decode(blob.slice(0, 4))).toBe("YRGN")
    expect(new TextDecoder("latin1").decode(blob.slice(-4))).toBe("ENDR")
  })
})

describe("lib/yamaha midi session", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetMidiSessionSingleton(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    resetMidiSessionSingleton(true)
  })

  it("routes send to port1, port2, or both", () => {
    const session = new YamahaMidiSession()
    const { output1, output2 } = wireConnectedSession(session)
    const message = Uint8Array.of(0xf0, 0x43, 0x60, 0x7a, 0xf7)

    session.sendPort1(message)
    expect(output1.sent).toHaveLength(1)
    expect(output2.sent).toHaveLength(0)

    session.sendPort2(message)
    expect(output2.sent).toHaveLength(1)

    session.sendBoth(message)
    expect(output1.sent).toHaveLength(2)
    expect(output2.sent).toHaveLength(2)
  })

  it("resolves request/reply matches", async () => {
    vi.useRealTimers()
    const session = new YamahaMidiSession()
    const { input1 } = wireConnectedSession(session)
    const reply = Uint8Array.from([0xf0, 0x43, 0x50, 0, 3, 0, 0xf7])

    const pending = session.request(
      Uint8Array.from([0xf0, 0x43, 0x50, 0, 0, 0, 0xf7]),
      (data) => data[1] === 0x43,
      1000,
      "port1",
    )
    input1.onmidimessage?.({ data: reply })
    await expect(pending).resolves.toEqual(reply)
  })

  it("rejects request/reply on timeout", async () => {
    const session = new YamahaMidiSession()
    wireConnectedSession(session)

    let rejection: Error | undefined
    const timeout = session
      .request(
        Uint8Array.from([0xf0, 0x43, 0x50, 0, 0, 0, 0xf7]),
        () => false,
        500,
        "port1",
      )
      .catch((error: Error) => {
        rejection = error
      })
    await vi.advanceTimersByTimeAsync(500)
    await timeout
    expect(rejection?.message).toBe("Timed out waiting for the keyboard response.")
  })

  it("panics with CC123 on all channels on both ports", () => {
    const session = new YamahaMidiSession()
    const { output1, output2 } = wireConnectedSession(session)
    session.panic()
    expect(output1.sent).toHaveLength(16)
    expect(output2.sent).toHaveLength(16)
    expect(output1.sent[0]).toEqual(Uint8Array.of(0xb0, 123, 0))
    expect(output1.sent[15]).toEqual(Uint8Array.of(0xbf, 123, 0))
  })

  it("disconnect rejects pending requests and clears outputs", async () => {
    const session = new YamahaMidiSession()
    wireConnectedSession(session)
    const pending = session.request(
      Uint8Array.from([0xf0, 0x43, 0x50, 0, 0, 0, 0xf7]),
      () => true,
      5000,
      "port1",
    )
    await session.disconnect("Keyboard disconnected.")
    await expect(pending).rejects.toThrow("Keyboard disconnected.")
    expect(session.state.connected).toBe(false)
    expect(session.state.error).toBe("Keyboard disconnected.")
  })

  it("detects keyboard via universal identity reply", async () => {
    vi.useRealTimers()
    const session = new YamahaMidiSession()
    const { input1 } = wireConnectedSession(session)

    const identityReply = Uint8Array.from([0xf0, 0x7e, 0x7f, 6, 2, 0x43, 0x7f, 0x68, 0, 0, 0xf7])
    const detectPromise = session.detectKeyboard()
    input1.onmidimessage?.({ data: identityReply })
    const profile = await detectPromise
    expect(profile?.id).toBe("genos2")
    expect(session.state.modelName).toBe("Genos2")
  })
})
