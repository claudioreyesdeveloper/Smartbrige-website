/**
 * Expected MIDI frames derived ONLY from application source modules.
 * Source of truth: lib/demo/yamaha/commands.ts, midi-session.ts, style-preview.ts,
 * section-record.ts, jam-scheduler.ts, musicsoft-transfer.ts,
 * and SmartBridge YamahaIdentityCatalog / KeyboardIdentifier for identity replies.
 */

import {
  ARRANGER_COMMANDS,
  chordNotes,
  chordOffMessages,
  chordOnMessages,
  mainCommand,
  tempoCommand,
} from "@/lib/demo/yamaha/commands"
import type { ArrangerSection } from "@/lib/demo/types"

export type PortExpect = "port1" | "port2" | "both"

export type ExpectedFrame = {
  /** Human label from decode / source comment */
  label: string
  ports: PortExpect
  bytes: number[]
  /** Absolute file path hint for failure reports */
  source: string
}

const toBytes = (data: Uint8Array) => Array.from(data)

/**
 * Universal Identity Reply frames verified in SmartBridge
 * (YamahaIdentityCatalog.cpp / KeyboardIdentifier.cpp).
 * Yamaha does not publish a public per-model table — these are hardware captures.
 * Tyros4: no verified Universal Identity tuple in-repo (UNKNOWN).
 */
export const IDENTITY_REPLIES = {
  /** sandsoftwaresound.net Genos Downloader capture */
  genosCaptured: {
    label: "Genos Identity Reply (capture)",
    bytes: [0xf0, 0x7e, 0x7f, 0x06, 0x02, 0x43, 0x00, 0x44, 0x42, 0x1c, 0x0a, 0x00, 0x00, 0x01, 0xf7],
    source: "SmartBridge/Source/Routing/YamahaIdentityCatalog.cpp (Genos capture)",
  },
  /** KeyboardIdentifier family 0x7F5E — member bytes unspecified (00 00) */
  genosFamily: {
    label: "Genos Identity Reply (family 7F 5E)",
    bytes: [0xf0, 0x7e, 0x7f, 0x06, 0x02, 0x43, 0x7f, 0x5e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf7],
    source: "SmartBridge/Source/Piano/KeyboardIdentifier.cpp case 0x7F5E",
  },
  /** KeyboardIdentifier family 0x7F68 */
  genos2: {
    label: "Genos2 Identity Reply (family 7F 68)",
    bytes: [0xf0, 0x7e, 0x7f, 0x06, 0x02, 0x43, 0x7f, 0x68, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf7],
    source: "SmartBridge/Source/Piano/KeyboardIdentifier.cpp case 0x7F68",
  },
  /** KeyboardIdentifier family 0x7F7F */
  tyros5: {
    label: "Tyros5 Identity Reply (family 7F 7F)",
    bytes: [0xf0, 0x7e, 0x7f, 0x06, 0x02, 0x43, 0x7f, 0x7f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf7],
    source: "SmartBridge/Source/Piano/KeyboardIdentifier.cpp case 0x7F7F",
  },
} as const

export const PROTOCOL = {
  /** midi-session.ts detectKeyboard — first attempt */
  universalIdentityRequest: {
    label: "Universal Identity Request",
    ports: "both" as PortExpect,
    bytes: [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7],
    source: "lib/demo/yamaha/midi-session.ts:detectKeyboard",
  },
  /** midi-session.ts detectKeyboard — Musicsoft fallback (Port 1 only) */
  musicsoftModelQuery: {
    label: "Musicsoft model query",
    ports: "port1" as PortExpect,
    bytes: [0xf0, 0x43, 0x50, 0x00, 0x00, 0x07, 0x01, 0xf7],
    source: "lib/demo/yamaha/midi-session.ts:detectKeyboard",
  },
  /** midi-session.ts panic — CC123 all notes off, all 16 channels, both ports */
  panicCc123(channelZeroBased: number): ExpectedFrame {
    return {
      label: `All Notes Off ch${channelZeroBased + 1}`,
      ports: "both",
      bytes: [0xb0 | channelZeroBased, 123, 0],
      source: "lib/demo/yamaha/midi-session.ts:panic",
    }
  },
  main(section: ArrangerSection): ExpectedFrame {
    return {
      label: `Yamaha Main ${section}`,
      ports: "both",
      bytes: toBytes(mainCommand(section)),
      source: "lib/demo/yamaha/commands.ts:mainCommand → section-record/jam-scheduler",
    }
  },
  arrangerStart: {
    label: "Yamaha Arranger Start",
    ports: "both" as PortExpect,
    bytes: toBytes(ARRANGER_COMMANDS.start),
    source: "lib/demo/yamaha/commands.ts:ARRANGER_COMMANDS.start",
  },
  arrangerStop: {
    label: "Yamaha Arranger Stop",
    ports: "both" as PortExpect,
    bytes: toBytes(ARRANGER_COMMANDS.stop),
    source: "lib/demo/yamaha/commands.ts:ARRANGER_COMMANDS.stop",
  },
  midiStart: {
    label: "MIDI Start (FA)",
    ports: "port1" as PortExpect,
    bytes: toBytes(ARRANGER_COMMANDS.midiStart),
    source: "lib/demo/yamaha/commands.ts:ARRANGER_COMMANDS.midiStart",
  },
  midiStop: {
    label: "MIDI Stop (FC)",
    ports: "port1" as PortExpect,
    bytes: toBytes(ARRANGER_COMMANDS.midiStop),
    source: "lib/demo/yamaha/commands.ts:ARRANGER_COMMANDS.midiStop",
  },
  midiClock: {
    label: "MIDI Clock (F8)",
    ports: "port1" as PortExpect,
    bytes: toBytes(ARRANGER_COMMANDS.midiClock),
    source: "lib/demo/yamaha/commands.ts:ARRANGER_COMMANDS.midiClock",
  },
  intro1: {
    label: "Yamaha Intro 1",
    ports: "both" as PortExpect,
    bytes: toBytes(ARRANGER_COMMANDS.intro1),
    source: "lib/demo/yamaha/commands.ts:ARRANGER_COMMANDS.intro1",
  },
  tempo(bpm: number): ExpectedFrame {
    return {
      label: `Yamaha Tempo ${bpm}`,
      ports: "both",
      bytes: toBytes(tempoCommand(bpm)),
      source: "lib/demo/yamaha/commands.ts:tempoCommand",
    }
  },
  /** section-record default chord "C" — Port 1 only */
  chordOnC(): ExpectedFrame[] {
    return chordOnMessages("C").map((message, index) => ({
      label: `Chord On C note[${index}]`,
      ports: "port1" as PortExpect,
      bytes: toBytes(message),
      source: "lib/demo/yamaha/commands.ts:chordOnMessages",
    }))
  },
  chordOffC(): ExpectedFrame[] {
    const notes = chordNotes("C")
    return chordOffMessages(notes).map((message, index) => ({
      label: `Chord Off C note[${index}]`,
      ports: "port1" as PortExpect,
      bytes: toBytes(message),
      source: "lib/demo/yamaha/commands.ts:chordOffMessages",
    }))
  },
  /** style-preview.ts XG voice setup on Port 2 */
  xgVoiceSetup(channelZeroBased: number, parameter: 1 | 2 | 3, value: number): ExpectedFrame {
    return {
      label: `XG Voice Setup ch${channelZeroBased + 1} p=${parameter}`,
      ports: "port2",
      bytes: [0xf0, 0x43, 0x10, 0x4c, 0x08, channelZeroBased, parameter, value & 0x7f, 0xf7],
      source: "lib/demo/style-preview.ts:sendEvent",
    }
  },
  /** MusicsoftTransfer.initialize model query — same bytes as detectKeyboard fallback */
  musicsoftInitModelQuery: {
    label: "Musicsoft model query (transfer)",
    ports: "port1" as PortExpect,
    bytes: [0xf0, 0x43, 0x50, 0x00, 0x00, 0x07, 0x01, 0xf7],
    source: "lib/demo/yamaha/musicsoft-transfer.ts:initialize",
  },
  musicsoftOpenTransfer: {
    label: "Musicsoft open transfer",
    ports: "port1" as PortExpect,
    bytes: [0xf0, 0x43, 0x50, 0x00, 0x00, 0x00, 0x01, 0xf7],
    source: "lib/demo/yamaha/musicsoft-transfer.ts:initialize",
  },
} as const

/** Expand a frame with ports:"both" into ordered Port1 then Port2 expectations. */
export function expandPorts(frame: ExpectedFrame): { portSuffix: string; bytes: number[]; label: string; source: string }[] {
  if (frame.ports === "both") {
    return [
      { portSuffix: "Port 1", bytes: frame.bytes, label: frame.label, source: frame.source },
      { portSuffix: "Port 2", bytes: frame.bytes, label: frame.label, source: frame.source },
    ]
  }
  const suffix = frame.ports === "port1" ? "Port 1" : "Port 2"
  return [{ portSuffix: suffix, bytes: frame.bytes, label: frame.label, source: frame.source }]
}

/**
 * Section record start sequence from SectionRecorder.start (golden order).
 * source: lib/demo/section-record.ts
 */
export function sectionRecordStartSequence(variation: ArrangerSection): ExpectedFrame[] {
  return [
    PROTOCOL.main(variation),
    PROTOCOL.midiStart,
    PROTOCOL.arrangerStart,
    ...PROTOCOL.chordOnC(),
  ]
}

/**
 * Section record stop sequence from SectionRecorder.stop.
 * source: lib/demo/section-record.ts
 */
export function sectionRecordStopSequence(): ExpectedFrame[] {
  return [
    PROTOCOL.arrangerStop,
    PROTOCOL.midiStop,
    ...PROTOCOL.chordOffC(),
    // panic follows — asserted separately as CC123 storm
  ]
}
