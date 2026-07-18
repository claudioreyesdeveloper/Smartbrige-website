export const readU16 = (data: Uint8Array, offset: number) =>
  (data[offset] << 8) | data[offset + 1]

export const readU32 = (data: Uint8Array, offset: number) =>
  data[offset] * 0x1000000 +
  (data[offset + 1] << 16) +
  (data[offset + 2] << 8) +
  data[offset + 3]

export const writeU16 = (value: number) => [(value >> 8) & 0xff, value & 0xff]

export const writeU32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

export const asciiBytes = (value: string) =>
  Uint8Array.from(new TextEncoder().encode(value))
