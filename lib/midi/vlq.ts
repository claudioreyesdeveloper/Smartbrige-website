export function readVlq(data: Uint8Array, start: number): [number, number] {
  let value = 0
  let offset = start
  for (let count = 0; count < 4 && offset < data.length; count += 1) {
    const byte = data[offset++]
    value = (value << 7) | (byte & 0x7f)
    if (!(byte & 0x80)) return [value, offset]
  }
  throw new Error("Invalid MIDI variable-length value.")
}

export function writeVlq(value: number): number[] {
  let buffer = Math.max(0, Math.floor(value)) & 0x7f
  const bytes: number[] = []
  let remaining = Math.max(0, Math.floor(value))
  while ((remaining >>= 7)) {
    buffer <<= 8
    buffer |= (remaining & 0x7f) | 0x80
  }
  for (;;) {
    bytes.push(buffer & 0xff)
    if (buffer & 0x80) buffer >>= 8
    else break
  }
  return bytes
}
