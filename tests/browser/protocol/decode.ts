/** Decode captured MIDI bytes for protocol logs — mirrors common Yamaha/demo traffic. */

export function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ")
}

export function decodeMidi(bytes: number[]): string {
  if (!bytes.length) return "(empty)"
  const status = bytes[0]

  if (status === 0xf0) {
    if (bytes[1] === 0x7e && bytes[3] === 0x06 && bytes[4] === 0x01) {
      return "Universal Identity Request"
    }
    if (bytes[1] === 0x7e && bytes[3] === 0x06 && bytes[4] === 0x02) {
      return "Universal Identity Reply"
    }
    if (bytes[1] === 0x43 && bytes[2] === 0x7e && bytes[3] === 0x00 && bytes[4] === 0x02) {
      return "Yamaha Tempo"
    }
    if (bytes[1] === 0x43 && bytes[2] === 0x7e && bytes[3] === 0x00) {
      const code = bytes[4]
      if (code === 0x08) return "Yamaha Main A"
      if (code === 0x09) return "Yamaha Main B"
      if (code === 0x0a) return "Yamaha Main C"
      if (code === 0x0b) return "Yamaha Main D"
      if (code === 0x00) return "Yamaha Intro 1"
      if (code === 0x10) return "Yamaha Fill AA"
      if (code === 0x11) return "Yamaha Fill BB"
      if (code === 0x12) return "Yamaha Fill CC"
      if (code === 0x13) return "Yamaha Fill DD"
      if (code === 0x18) return "Yamaha Break"
      if (code === 0x20) return "Yamaha Ending 1"
      return `Yamaha Arranger SysEx code=0x${code.toString(16)}`
    }
    if (bytes[1] === 0x43 && bytes[2] === 0x60 && bytes[3] === 0x7a) return "Yamaha Arranger Start"
    if (bytes[1] === 0x43 && bytes[2] === 0x60 && bytes[3] === 0x7d) return "Yamaha Arranger Stop"
    if (bytes[1] === 0x43 && bytes[2] === 0x10 && bytes[3] === 0x4c && bytes[4] === 0x08) {
      const ch = bytes[5]
      const param = bytes[6]
      const value = bytes[7]
      const paramName = param === 1 ? "BankMSB" : param === 2 ? "BankLSB" : param === 3 ? "Program" : `P${param}`
      return `XG Style Voice Setup ch=${ch + 1} ${paramName}=${value}`
    }
    if (bytes[1] === 0x43 && bytes[2] === 0x50) {
      return `Musicsoft SysEx [${bytesToHex(bytes.slice(2, Math.min(8, bytes.length - 1)))}…]`
    }
    if (bytes[1] === 0x43 && bytes[2] === 0x73) return "Yamaha Style Select"
    return `SysEx len=${bytes.length}`
  }

  if (status === 0xfa) return "MIDI Start (FA)"
  if (status === 0xfc) return "MIDI Stop (FC)"
  if (status === 0xf8) return "MIDI Clock (F8)"

  const kind = status & 0xf0
  const channel = (status & 0x0f) + 1
  if (kind === 0x80) return `Note Off ch${channel} note=${bytes[1]} vel=${bytes[2]}`
  if (kind === 0x90) {
    if ((bytes[2] || 0) === 0) return `Note Off(ch${channel}) note=${bytes[1]} via vel0`
    return `Note On ch${channel} note=${bytes[1]} vel=${bytes[2]}`
  }
  if (kind === 0xb0) {
    if (bytes[1] === 123) return `All Notes Off (CC123) ch${channel}`
    if (bytes[1] === 0) return `Bank MSB ch${channel}=${bytes[2]}`
    if (bytes[1] === 32) return `Bank LSB ch${channel}=${bytes[2]}`
    return `CC ch${channel} cc=${bytes[1]} val=${bytes[2]}`
  }
  if (kind === 0xc0) return `Program Change ch${channel} pc=${bytes[1]}`
  return `status=0x${status.toString(16)} len=${bytes.length}`
}
