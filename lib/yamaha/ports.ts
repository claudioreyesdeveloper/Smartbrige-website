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
  // Tolerate "Port 1", "Port1", trailing "-1"/" 1", and "MIDIIN2 (Genos2)" style tags.
  const tag =
    portNumber === 1
      ? /(?:port\s*1|midi\s*in\s*1|midi\s*out\s*1|[-_]1|\b1\b)\s*$/i.test(port.name) ||
        /port\s*1/i.test(port.name)
      : /(?:port\s*2|midi\s*in\s*2|midi\s*out\s*2|[-_]2|\b2\b)\s*$/i.test(port.name) ||
        /port\s*2/i.test(port.name)
  return tag
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
