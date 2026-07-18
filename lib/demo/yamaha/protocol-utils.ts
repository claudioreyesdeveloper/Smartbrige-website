export function encodePayload7(data: Uint8Array): Uint8Array {
  const output: number[] = []
  for (let offset = 0; offset < data.length; offset += 7) {
    const group = data.slice(offset, offset + 7)
    let status = 0
    const body = Array.from(group, (byte, index) => {
      if (byte > 0x7f) {
        status |= 1 << (6 - index)
        return byte - 0x80
      }
      return byte
    })
    output.push(status, ...body)
  }
  return Uint8Array.from(output)
}

export function decodePayload7(data: Uint8Array): Uint8Array {
  const output: number[] = []
  for (let offset = 0; offset < data.length; offset += 8) {
    const group = data.slice(offset, offset + 8)
    if (!group.length) break
    const status = group[0]
    for (let index = 1; index < group.length; index += 1) {
      const bit = 7 - index
      output.push(group[index] + (((status >> bit) & 1) ? 0x80 : 0))
    }
  }
  return Uint8Array.from(output)
}

export function data7(value: number, width: number): number[] {
  const bytes: number[] = []
  let remaining = Math.max(0, Math.floor(value))
  while (remaining > 0) {
    bytes.unshift(remaining & 0x7f)
    remaining >>= 7
  }
  while (bytes.length < width) bytes.unshift(0)
  return bytes.slice(-width)
}

export function checksum7(payload: Uint8Array | number[]): number {
  const sum = Array.from(payload).reduce((total, byte) => total + byte, 0)
  return (128 - (sum % 128)) % 128
}

export function ascii(value: string, nullTerminated = false): Uint8Array {
  const bytes = Array.from(value, (character) => character.charCodeAt(0) & 0xff)
  if (nullTerminated) bytes.push(0)
  return Uint8Array.from(bytes)
}

export function text(data: Uint8Array): string {
  const end = data.indexOf(0)
  const useful = end >= 0 ? data.slice(0, end) : data
  return new TextDecoder("latin1").decode(useful).trim()
}

export function startsWithBytes(data: Uint8Array, prefix: number[]): boolean {
  return prefix.every((byte, index) => data[index] === byte)
}
