/**
 * Canonical preset-style wire encoding (SmartBridge YamahaStyleSelection.h).
 *
 * Genos / Genos2: numeric 14-bit catalog value (split 7 + 7)
 * Tyros:          legacy packed wire bytes (high byte + low byte)
 */

export type CatalogEncoding = "numeric14Bit" | "packedWireBytes"

export type WireCode = {
  first: number
  second: number
  valid: boolean
}

export function fromNumeric14Bit(styleNumber: number): WireCode {
  if (styleNumber < 0 || styleNumber > 0x3fff) {
    return { first: 0, second: 0, valid: false }
  }
  return {
    first: (styleNumber >> 7) & 0x7f,
    second: styleNumber & 0x7f,
    valid: true,
  }
}

export function fromPackedWireBytes(packedValue: number): WireCode {
  if (packedValue < 0 || packedValue > 0xffff) {
    return { first: 0, second: 0, valid: false }
  }
  return {
    first: (packedValue >> 8) & 0x7f,
    second: packedValue & 0x7f,
    valid: true,
  }
}

export function encodingForKeyboardType(keyboardType: string): CatalogEncoding {
  const normalized = keyboardType.trim().toLowerCase()
  return normalized === "genos" || normalized === "genos1" || normalized === "genos2"
    ? "numeric14Bit"
    : "packedWireBytes"
}

export function wireCodeForKeyboard(keyboardType: string, styleNumber: number): WireCode {
  return encodingForKeyboardType(keyboardType) === "numeric14Bit"
    ? fromNumeric14Bit(styleNumber)
    : fromPackedWireBytes(styleNumber)
}

/** F0 43 73 01 51 05 00 03 04 00 00 [first] [second] F7 */
export function createPresetStyleSelectSysEx(keyboardType: string, styleNumber: number): Uint8Array | null {
  const code = wireCodeForKeyboard(keyboardType, styleNumber)
  if (!code.valid) return null
  return Uint8Array.from([
    0xf0,
    0x43,
    0x73,
    0x01,
    0x51,
    0x05,
    0x00,
    0x03,
    0x04,
    0x00,
    0x00,
    code.first,
    code.second,
    0xf7,
  ])
}
