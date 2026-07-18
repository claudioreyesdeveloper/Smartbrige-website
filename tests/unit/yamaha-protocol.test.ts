import { describe, expect, it } from "vitest"
import songs from "@/data/demo/songs.json"
import { buildJamSchedule } from "@/lib/demo/jam-scheduler"
import type { DemoSong } from "@/lib/demo/types"
import {
  ARRANGER_COMMANDS,
  chordNotes,
  fillCommand,
  mainCommand,
  styleSelectCommand,
  tempoCommand,
} from "@/lib/demo/yamaha/commands"
import {
  KEYBOARD_PROFILES,
  profileFromUniversalIdentity,
} from "@/lib/demo/yamaha/profiles"
import {
  styleMappingForEntry,
  stylesForProfile,
} from "@/lib/demo/yamaha/style-catalog"
import { MusicsoftTransfer } from "@/lib/demo/yamaha/musicsoft-transfer"
import {
  findYamahaPortPair,
  isYamahaArrangerPort,
  isYamahaMidiPort2,
} from "@/lib/demo/yamaha/midi-session"
import {
  checksum7,
  decodePayload7,
  encodePayload7,
} from "@/lib/demo/yamaha/protocol-utils"

describe("Yamaha commands", () => {
  it("pairs Yamaha arranger Port 1 and Port 2 like desktop SmartBridge", () => {
    expect(isYamahaArrangerPort({ name: "Digital Keyboard Port 1", manufacturer: "Yamaha Corporation" }, 1)).toBe(true)
    expect(isYamahaArrangerPort({ name: "Digital Keyboard Port 2", manufacturer: "Yamaha Corporation" }, 2)).toBe(true)
    expect(isYamahaMidiPort2({ name: "Digital Workstation-2", manufacturer: "Yamaha" })).toBe(true)
    expect(isYamahaMidiPort2({ name: "Digital Keyboard Port 1", manufacturer: "Yamaha Corporation" })).toBe(false)
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

  it("builds the desktop-compatible tempo and arranger messages", () => {
    expect([...tempoCommand(120)]).toEqual([0xf0, 0x43, 0x7e, 0, 2, 9, 48, 0xf7])
    expect([...ARRANGER_COMMANDS.start]).toEqual([0xf0, 0x43, 0x60, 0x7a, 0xf7])
    expect([...ARRANGER_COMMANDS.intro1]).toEqual([0xf0, 0x43, 0x7e, 0, 0, 0x7f, 0xf7])
    expect([...mainCommand("D")]).toEqual([0xf0, 0x43, 0x7e, 0, 0x0b, 0x7f, 0xf7])
    expect([...fillCommand("B")]).toEqual([0xf0, 0x43, 0x7e, 0, 0x11, 0x7f, 0xf7])
  })

  it("uses explicit model-scoped style bytes", () => {
    expect([...styleSelectCommand(KEYBOARD_PROFILES.genos.styleMappings.Gospel)].slice(-3, -1))
      .toEqual([0x2b, 0x62])
    expect([...styleSelectCommand(KEYBOARD_PROFILES.tyros5.styleMappings.Gospel)].slice(-3, -1))
      .toEqual([0x15, 0x62])
  })

  it("exposes every supported model catalog with desktop-compatible encoding", () => {
    expect(stylesForProfile(KEYBOARD_PROFILES.genos)).toHaveLength(550)
    expect(stylesForProfile(KEYBOARD_PROFILES.genos2)).toHaveLength(796)
    expect(stylesForProfile(KEYBOARD_PROFILES.tyros4)).toHaveLength(509)
    expect(stylesForProfile(KEYBOARD_PROFILES.tyros5)).toHaveLength(537)

    const genosStyle = { name: "Test", category: "Pop", bpm: 120, styleNumber: 5635 }
    const tyrosStyle = { ...genosStyle, styleNumber: 5602 }
    expect(styleMappingForEntry(KEYBOARD_PROFILES.genos, genosStyle).bytes).toEqual([0x2c, 0x03])
    expect(styleMappingForEntry(KEYBOARD_PROFILES.tyros5, tyrosStyle).bytes).toEqual([0x15, 0x62])
  })

  it("recognizes verified Yamaha universal identity tuples", () => {
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

  it("creates silent lower-channel chord notes including slash bass", () => {
    expect(chordNotes("Cmaj7")).toEqual([36, 40, 43, 47])
    expect(chordNotes("G7/B")).toEqual([35, 43, 47, 50, 53])
  })
})

describe("Musicsoft payload helpers", () => {
  it("round-trips arbitrary eight-bit data through Yamaha 7-bit packing", () => {
    const source = Uint8Array.from([0, 1, 127, 128, 200, 255, 64, 129, 20])
    expect([...decodePayload7(encodePayload7(source))]).toEqual([...source])
  })

  it("matches the modulo-128 checksum rule", () => {
    const payload = Uint8Array.from([2, 2, 0, 127, 1])
    expect((payload.reduce((sum, byte) => sum + byte, 0) + checksum7(payload)) % 128)
      .toBe(0)
  })

  it("uploads 210-byte chunks with sequence and checksum before close", async () => {
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
    const packets = commands.filter(
      (command) => command[1] === 0x43 && command[3] === 0x01,
    )
    expect(packets).toHaveLength(2)
    expect(packets[0][8]).toBe(0)
    expect(packets[1][8]).toBe(1)
    packets.forEach((packet) => {
      const payload = packet.slice(6, -2)
      expect((payload.reduce((sum, byte) => sum + byte, 0) + packet.at(-2)!) % 128)
        .toBe(0)
    })
    expect([...commands.at(-1)!]).toEqual([0xf0, 0x43, 0x50, 0, 3, 2, 0xf7])
  })
})

describe("complete Jam Player catalog and schedule", () => {
  const catalog = songs as DemoSong[]

  it("contains two complete 4/4 songs in every requested category", () => {
    const categories = ["Pop", "Rock", "Ballad", "Dance", "Latin", "Swing & Jazz", "R&B", "Country"]
    expect(catalog).toHaveLength(16)
    categories.forEach((category) => {
      expect(catalog.filter((song) => song.category === category)).toHaveLength(2)
    })
    catalog.forEach((song) => {
      expect(song.timeSignature).toEqual([4, 4])
      expect(song.sections.length).toBeGreaterThanOrEqual(4)
      expect(song.sections.every((section) => section.chords.length > 0)).toBe(true)
    })
    expect(catalog.reduce((total, song) => total + song.sections.length, 0)).toBe(81)
    expect(
      catalog.reduce(
        (total, song) =>
          total + song.sections.reduce((sectionTotal, section) => sectionTotal + section.chords.length, 0),
        0,
      ),
    ).toBe(1078)
  })

  it("anticipates chords without moving section commands early", () => {
    const schedule = buildJamSchedule(catalog[0], 85)
    const firstChord = schedule.find((event) => event.type === "chord")
    expect(firstChord?.dispatchBeat).toBe(firstChord?.beat)
    const anticipated = schedule.find(
      (event) => event.type === "chord" && event.beat > event.section!.chords[0].beat + 4,
    )
    expect(anticipated).toBeDefined()
    expect(anticipated!.dispatchBeat).toBeLessThan(anticipated!.beat)
    schedule
      .filter((event) => event.type === "main" || event.type === "section")
      .forEach((event) => expect(event.dispatchBeat).toBe(event.beat))
    expect(schedule.filter((event) => event.type === "ending")).toHaveLength(1)
  })
})
