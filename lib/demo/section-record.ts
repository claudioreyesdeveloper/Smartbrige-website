/**
 * Port of JamPlayerScreen::startSectionRecording / stopSectionRecording
 * for the Style Maker web demo (Main A–D variation + style-engine capture).
 */

import type { ArrangerSection } from "@/lib/demo/types"
import {
  ARRANGER_COMMANDS,
  chordOffMessages,
  chordOnMessages,
  chordNotes,
  mainCommand,
} from "@/lib/demo/yamaha/commands"
import type { YamahaMidiSession } from "@/lib/demo/yamaha/midi-session"
import { StyleCapture, type CapturedMidiEvent } from "@/lib/demo/style-capture"
import {
  exportRecordedStyleMidi,
  filterAndRenumberSectionCapture,
  renumberedCaptureToLaneNotes,
  STYLE_CHANNEL_NAMES,
  type RenumberedCaptureEvent,
} from "@/lib/demo/recorded-style-export"
import type { MidiNote } from "@/lib/demo/style-midi"

export { STYLE_CHANNEL_NAMES }

export type SectionRecordTake = {
  events: RenumberedCaptureEvent[]
  midiBytes: Uint8Array
  laneNotes: MidiNote[][]
  variation: ArrangerSection
  bpm: number
  beatZeroOffsetSeconds: number
}

export type SectionRecordOptions = {
  variation: ArrangerSection
  /** Section length in MIDI ticks (desktop clip duration). */
  sectionTicks: number
  ticksPerQuarter: number
  bpm?: number
  /** Length-8 flags for Rhythm1…Phrase2 (desktop channelsEnabled). */
  channelsEnabled?: boolean[]
  includeControlData?: boolean
  chord?: string
  onAutoStop?: (take: SectionRecordTake | null) => void
}

export class SectionRecorder {
  private capture: StyleCapture
  private recording = false
  private startSeconds = 0
  private beatZeroOffsetSeconds = 0
  private autoStopTimer: ReturnType<typeof setTimeout> | null = null
  private heldChordNotes: number[] = []
  private options: SectionRecordOptions | null = null

  constructor(private readonly session: YamahaMidiSession) {
    this.capture = new StyleCapture(session)
  }

  get isRecording() {
    return this.recording
  }

  /**
   * Mirrors startSectionRecording:
   * arm capture → send Main variation → start arranger → hold chord.
   */
  start(options: SectionRecordOptions) {
    if (this.recording) {
      throw new Error("Another recording is currently active. Please stop it first.")
    }
    const bpm = options.bpm && options.bpm > 0 ? options.bpm : 120
    const channelsEnabled =
      options.channelsEnabled?.length === 8
        ? options.channelsEnabled
        : [true, true, true, true, true, true, true, true]

    this.options = { ...options, bpm, channelsEnabled }
    this.startSeconds = performance.now() / 1000
    this.beatZeroOffsetSeconds = 0
    this.capture.start(this.startSeconds)
    this.recording = true

    // Desktop: sendTyrosStyleVariation then playClip.
    this.session.sendBoth(mainCommand(options.variation))
    this.session.sendPort1(ARRANGER_COMMANDS.midiStart)
    this.session.sendBoth(ARRANGER_COMMANDS.start)

    const chordName = options.chord || "C"
    this.heldChordNotes = chordNotes(chordName)
    for (const message of chordOnMessages(chordName)) {
      this.session.sendPort1(message)
    }

    // Anchor after start (desktop sets beatZeroOffset from clip start).
    this.beatZeroOffsetSeconds = Math.max(
      0,
      performance.now() / 1000 - this.startSeconds,
    )

    const sectionBeats =
      options.sectionTicks / Math.max(1, options.ticksPerQuarter)
    const durationMs = (sectionBeats * 60_000) / bpm
    this.autoStopTimer = setTimeout(() => {
      try {
        const take = this.stop()
        options.onAutoStop?.(take)
      } catch {
        options.onAutoStop?.(null)
      }
    }, Math.max(250, durationMs))
  }

  /**
   * Mirrors stopSectionRecording (notes-only filter + renumber + export).
   */
  stop(): SectionRecordTake | null {
    if (!this.recording || !this.options) return null
    this.recording = false
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer)
      this.autoStopTimer = null
    }

    this.session.sendBoth(ARRANGER_COMMANDS.stop)
    this.session.sendPort1(ARRANGER_COMMANDS.midiStop)
    for (const message of chordOffMessages(this.heldChordNotes)) {
      this.session.sendPort1(message)
    }
    this.heldChordNotes = []
    this.session.panic()

    const raw: CapturedMidiEvent[] = this.capture.stopAndFetch()
    const channelsEnabled = this.options.channelsEnabled || [
      true, true, true, true, true, true, true, true,
    ]
    const events = filterAndRenumberSectionCapture(
      raw,
      channelsEnabled,
      this.options.includeControlData || false,
    )
    const bpm = this.options.bpm || 120
    const midiBytes = exportRecordedStyleMidi(events, {
      bpm,
      beatZeroOffsetSeconds: this.beatZeroOffsetSeconds,
      songName: `Main ${this.options.variation}`,
    })
    const laneNotes = renumberedCaptureToLaneNotes(
      events,
      bpm,
      this.beatZeroOffsetSeconds,
    )

    const take: SectionRecordTake = {
      events,
      midiBytes,
      laneNotes,
      variation: this.options.variation,
      bpm,
      beatZeroOffsetSeconds: this.beatZeroOffsetSeconds,
    }
    this.options = null
    return take
  }

  cancel() {
    if (!this.recording) return
    this.recording = false
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer)
      this.autoStopTimer = null
    }
    this.capture.cancel()
    this.session.sendBoth(ARRANGER_COMMANDS.stop)
    this.session.sendPort1(ARRANGER_COMMANDS.midiStop)
    for (const message of chordOffMessages(this.heldChordNotes)) {
      this.session.sendPort1(message)
    }
    this.heldChordNotes = []
    this.session.panic()
    this.options = null
  }
}

export function mainLabelToVariation(label: string): ArrangerSection {
  const match = label.trim().match(/^Main\s+([A-D])$/i)
  const letter = (match?.[1] || "A").toUpperCase() as ArrangerSection
  return letter
}
