import type { MidiPortChoice, YamahaPortPair } from "@/lib/yamaha/types"

/**
 * Web-MIDI port pairing for Yamaha arranger keyboards.
 * Broader than LocalMidiConnector::isYamahaUsbArrangerPort (Digital Keyboard/Workstation only)
 * to tolerate OS/driver naming variants (Genos, Tyros, etc.).
 */
export function isYamahaArrangerPort(
  port: Pick<MidiPortChoice, "name" | "manufacturer">,
  portNumber: 1 | 2,
): boolean {
  const identity = `${port.manufacturer} ${port.name}`
  if (/smartbridge/i.test(identity)) return false
  if (!/yamaha|digital keyboard|digital workstation|genos|tyros/i.test(identity)) {
    return false
  }
  const tag = portNumber === 1 ? /(?:port\s*1|[- ]1)$/i : /(?:port\s*2|[- ]2)$/i
  return tag.test(port.name)
}

/** @deprecated Prefer isYamahaArrangerPort(port, 2). */
export function isYamahaMidiPort2(port: Pick<MidiPortChoice, "name" | "manufacturer">): boolean {
  return isYamahaArrangerPort(port, 2)
}

export function findYamahaPortPair(
  inputs: MidiPortChoice[],
  outputs: MidiPortChoice[],
): YamahaPortPair | null {
  const input1 = inputs.find((port) => isYamahaArrangerPort(port, 1))
  const input2 = inputs.find((port) => isYamahaArrangerPort(port, 2))
  const output1 = outputs.find((port) => isYamahaArrangerPort(port, 1))
  const output2 = outputs.find((port) => isYamahaArrangerPort(port, 2))
  if (!input1 || !input2 || !output1 || !output2) return null
  return { input1, input2, output1, output2 }
}
