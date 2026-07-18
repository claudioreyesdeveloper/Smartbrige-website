/**
 * Port of SmartBridgeContext style-engine capture:
 * startStyleCapture / captureStyleMidiIfActive / stopStyleCaptureAndFetch.
 * Captures Yamaha style parts on MIDI channels 9–16 (port-agnostic).
 */

import type { YamahaMidiSession } from "@/lib/demo/yamaha/midi-session"

export type CapturedMidiEvent = {
  /** Seconds relative to capture start (desktop MidiMessage timestamp). */
  timeSeconds: number
  status: number
  data: number[]
}

export class StyleCapture {
  private active = false
  private startSeconds = 0
  private buffer: CapturedMidiEvent[] = []
  private listener: ((event: Event) => void) | null = null

  constructor(private readonly session: YamahaMidiSession) {}

  get isActive() {
    return this.active
  }

  /** Mirrors SmartBridgeContext::startStyleCapture. */
  start(captureStartTimeSeconds = performance.now() / 1000) {
    this.buffer = []
    this.startSeconds = captureStartTimeSeconds
    this.active = true
    this.listener = (event: Event) => {
      const detail = (event as CustomEvent<Uint8Array>).detail
      if (detail) this.captureMessage(detail)
    }
    this.session.addEventListener("midimessage", this.listener)
  }

  /**
   * Mirrors SmartBridgeContext::captureStyleMidiIfActive.
   * Channel 9–16 only; SysEx kept for later filter; Active Sense skipped.
   */
  private captureMessage(bytes: Uint8Array) {
    if (!this.active || !bytes.length) return
    if (bytes[0] === 0xfe) return // Active Sense

    const status = bytes[0]
    if (status === 0xf0) {
      // SysEx: keep (section export decides whether to retain)
      const nowSec = performance.now() / 1000
      let relTime = nowSec - this.startSeconds
      if (relTime < 0) relTime = 0
      this.buffer.push({
        timeSeconds: relTime,
        status: 0xf0,
        data: Array.from(bytes.slice(1)),
      })
      return
    }

    if (status < 0x80 || status >= 0xf0) return
    const channel = (status & 0x0f) + 1 // 1–16
    if (channel < 9 || channel > 16) return

    const nowSec = performance.now() / 1000
    let relTime = nowSec - this.startSeconds
    if (relTime < 0) relTime = 0
    this.buffer.push({
      timeSeconds: relTime,
      status,
      data: Array.from(bytes.slice(1)),
    })
  }

  /** Mirrors SmartBridgeContext::stopStyleCaptureAndFetch. */
  stopAndFetch(): CapturedMidiEvent[] {
    this.active = false
    if (this.listener) {
      this.session.removeEventListener("midimessage", this.listener)
      this.listener = null
    }
    const copy = this.buffer.slice()
    this.buffer = []
    return copy
  }

  cancel() {
    this.stopAndFetch()
  }
}
