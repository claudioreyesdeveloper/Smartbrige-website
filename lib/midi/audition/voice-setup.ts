/**
 * Yamaha XG Multi-Part voice setup for style-part channels 9–16.
 *
 * Verified against:
 * - Demo `lib/demo/style-preview.ts` (StylePreviewPlayer)
 * - Desktop `YamahaSysExBuilder::multiPartParam` / `InstrumentController::SetVoice`
 * - `YamahaProtocol::MultiPart::{kBankMSB=0x01,kBankLSB=0x02,kProgram=0x03}`
 *
 * Wire format: F0 43 10 4C 08 [part] [param] [value] F7
 * where part is the 0-based MIDI channel (8–15 for style parts).
 */

import {
  STYLE_PART_CHANNEL_FIRST,
  STYLE_PART_CHANNEL_LAST,
} from "./types"

export const XG_MULTIPART_ADDR = 0x08
export const XG_MULTIPART_BANK_MSB = 0x01
export const XG_MULTIPART_BANK_LSB = 0x02
export const XG_MULTIPART_PROGRAM = 0x03

export function isStylePartChannel(channel: number): boolean {
  return channel >= STYLE_PART_CHANNEL_FIRST && channel <= STYLE_PART_CHANNEL_LAST
}

/** Build a verified XG Multi-Part parameter SysEx message. */
export function xgMultiPartMessage(part: number, parameter: number, value: number): Uint8Array {
  return Uint8Array.of(
    0xf0,
    0x43,
    0x10,
    0x4c,
    XG_MULTIPART_ADDR,
    part & 0x0f,
    parameter & 0x7f,
    value & 0x7f,
    0xf7,
  )
}

/**
 * Map a channel voice-setup event on style-part channels to XG Multi-Part SysEx.
 * Returns null when the event is not a bank/program setup message for those channels.
 */
export function stylePartVoiceSetupSysEx(
  status: number,
  data: number[],
): Uint8Array | null {
  const kind = status & 0xf0
  const channel = status & 0x0f
  if (!isStylePartChannel(channel)) return null

  if (kind === 0xb0) {
    const controller = data[0]
    const value = data[1] ?? 0
    if (controller === 0) return xgMultiPartMessage(channel, XG_MULTIPART_BANK_MSB, value)
    if (controller === 32) return xgMultiPartMessage(channel, XG_MULTIPART_BANK_LSB, value)
    return null
  }

  if (kind === 0xc0) {
    return xgMultiPartMessage(channel, XG_MULTIPART_PROGRAM, data[0] ?? 0)
  }

  return null
}
