/**
 * Port of JamPlayerScreen::startSectionRecording / stopSectionRecording
 * for paid Jam Player (Main A–D, fill-in, mute, capture ch 9–16, SMF export).
 */

import type { ArrangerSection } from "@/lib/yamaha/types"
import {
  ARRANGER_COMMANDS,
  chordOffMessages,
  chordOnMessages,
  chordNotes,
  fillCommand,
  mainCommand,
} from "@/lib/yamaha/commands"
import type { YamahaMidiSession } from "@/lib/yamaha/midi-session"
import { StyleCapture, type CapturedMidiEvent } from "@/lib/yamaha/style-capture"
import {
  exportRecordedStyleMidi,
  filterAndRenumberSectionCapture,
  STYLE_CHANNEL_NAMES,
  type RenumberedCaptureEvent,
} from "@/lib/yamaha/recorded-style-export"

export { STYLE_CHANNEL_NAMES }

export type SectionFillIn = "Off" | ArrangerSection | "Break"

export type SectionRecordChord = {
  beat: number
  duration: number
  name: string
}

export type SectionRecordTake = {
  events: RenumberedCaptureEvent[]
  midiBytes: Uint8Array
  variation: ArrangerSection
  fillIn: SectionFillIn
  bpm: number
  beatZeroOffsetSeconds: number
  fileName: string
}

export type SectionRecordOptions = {
  variation: ArrangerSection
  fillIn?: SectionFillIn
  /** Section length in beats (desktop clip duration). */
  sectionBeats: number
  bpm?: number
  /** Length-8 flags for Rhythm1…Phrase2 (desktop channelsEnabled). */
  channelsEnabled?: boolean[]
  includeControlData?: boolean
  /** Chord timeline for this section (desktop playClip progression). */
  chords?: SectionRecordChord[]
  /** Fallback when chords are empty. */
  chord?: string
  songTitle?: string
  sectionLabel?: string
  onAutoStop?: (take: SectionRecordTake | null) => void
}

function volumeCc(channel1Based: number, value: number): Uint8Array {
  return Uint8Array.of(0xb0 | ((channel1Based - 1) & 0x0f), 7, value & 0x7f)
}

function sendFillIn(session: YamahaMidiSession, fillIn: SectionFillIn) {
  if (fillIn === "Off") return
  if (fillIn === "Break") {
    session.sendBoth(ARRANGER_COMMANDS.break)
    return
  }
  session.sendBoth(fillCommand(fillIn))
}

export class SectionRecorder {
  private capture: StyleCapture
  private recording = false
  private startSeconds = 0
  private beatZeroOffsetSeconds = 0
  private autoStopTimer: ReturnType<typeof setTimeout> | null = null
  private fillTimer: ReturnType<typeof setTimeout> | null = null
  private chordTimers: ReturnType<typeof setTimeout>[] = []
  private heldChordNotes: number[] = []
  private mutedChannels: boolean[] = Array(8).fill(false)
  private options: SectionRecordOptions | null = null

  constructor(private readonly session: YamahaMidiSession) {
    this.capture = new StyleCapture(session)
  }

  get isRecording() {
    return this.recording
  }

  /**
   * Mirrors startSectionRecording:
   * mute → arm capture → Main variation → start arranger → walk chords → optional fill.
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
    const fillIn = options.fillIn ?? "Off"
    const sectionBeats = Math.max(1, options.sectionBeats)

    this.options = { ...options, bpm, channelsEnabled, fillIn, sectionBeats }
    this.startSeconds = performance.now() / 1000
    this.beatZeroOffsetSeconds = 0
    this.mutedChannels = Array(8).fill(false)

    // Desktop: muteTyrosChannels before capture.
    for (let i = 0; i < 8; i += 1) {
      if (!channelsEnabled[i]) {
        this.session.sendBoth(volumeCc(9 + i, 0))
        this.mutedChannels[i] = true
      }
    }

    this.capture.start(this.startSeconds)
    this.recording = true

    this.session.sendBoth(mainCommand(options.variation))
    this.session.sendPort1(ARRANGER_COMMANDS.midiStart)
    this.session.sendBoth(ARRANGER_COMMANDS.start)

    this.scheduleChords(options.chords, options.chord || "C", bpm)
    this.beatZeroOffsetSeconds = Math.max(
      0,
      performance.now() / 1000 - this.startSeconds,
    )

    // Desktop JamPlayerScreen_Playback: fill at last-bar start − 0.2 beats
    // (fillInTriggerBeat = duration − bpb − variationAnticipation).
    if (fillIn !== "Off") {
      const beatsPerBar = 4
      const fillTriggerBeats = Math.max(0, sectionBeats - beatsPerBar - 0.2)
      const fillMs = (fillTriggerBeats * 60_000) / bpm
      this.fillTimer = setTimeout(() => {
        if (!this.recording || !this.options) return
        sendFillIn(this.session, this.options.fillIn ?? "Off")
      }, fillMs)
    }

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

  private scheduleChords(
    chords: SectionRecordChord[] | undefined,
    fallbackChord: string,
    bpm: number,
  ) {
    const beatMs = 60_000 / bpm
    const timeline =
      chords && chords.length > 0
        ? [...chords].sort((a, b) => a.beat - b.beat)
        : [{ beat: 0, duration: 4, name: fallbackChord }]

    const applyChord = (name: string) => {
      for (const message of chordOffMessages(this.heldChordNotes)) {
        this.session.sendPort1(message)
      }
      this.heldChordNotes = chordNotes(name)
      for (const message of chordOnMessages(name)) {
        this.session.sendPort1(message)
      }
    }

    applyChord(timeline[0]!.name)
    for (let i = 1; i < timeline.length; i += 1) {
      const chord = timeline[i]!
      const delay = Math.max(0, chord.beat * beatMs)
      this.chordTimers.push(
        setTimeout(() => {
          if (!this.recording) return
          applyChord(chord.name)
        }, delay),
      )
    }
  }

  private clearTimers() {
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer)
      this.autoStopTimer = null
    }
    if (this.fillTimer) {
      clearTimeout(this.fillTimer)
      this.fillTimer = null
    }
    for (const timer of this.chordTimers) clearTimeout(timer)
    this.chordTimers = []
  }

  private unmuteChannels() {
    for (let i = 0; i < 8; i += 1) {
      if (!this.mutedChannels[i]) continue
      this.session.sendBoth(volumeCc(9 + i, 100))
      this.mutedChannels[i] = false
    }
  }

  private stopArranger() {
    this.session.sendBoth(ARRANGER_COMMANDS.stop)
    this.session.sendPort1(ARRANGER_COMMANDS.midiStop)
    for (const message of chordOffMessages(this.heldChordNotes)) {
      this.session.sendPort1(message)
    }
    this.heldChordNotes = []
    this.unmuteChannels()
    this.session.panic()
  }

  /**
   * Mirrors stopSectionRecording (filter + renumber + export).
   */
  stop(): SectionRecordTake | null {
    if (!this.recording || !this.options) return null
    this.recording = false
    this.clearTimers()
    this.stopArranger()

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
    const variation = this.options.variation
    const fillIn = this.options.fillIn ?? "Off"
    const sectionLabel = this.options.sectionLabel || `Main ${variation}`
    const songTitle = this.options.songTitle || "Song"
    const midiBytes = exportRecordedStyleMidi(events, {
      bpm,
      beatZeroOffsetSeconds: this.beatZeroOffsetSeconds,
      songName: `${songTitle} ${sectionLabel}`,
    })
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fileName = `SECTION_${songTitle}_${sectionLabel}_${variation}_${stamp}.mid`
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9._-]/g, "")

    const take: SectionRecordTake = {
      events,
      midiBytes,
      variation,
      fillIn,
      bpm,
      beatZeroOffsetSeconds: this.beatZeroOffsetSeconds,
      fileName,
    }
    this.options = null
    return take
  }

  cancel() {
    if (!this.recording) return
    this.recording = false
    this.clearTimers()
    this.capture.cancel()
    this.stopArranger()
    this.options = null
  }
}

export function mainLabelToVariation(label: string): ArrangerSection {
  const match = label.trim().match(/^Main\s+([A-D])$/i)
  const letter = (match?.[1] || "A").toUpperCase() as ArrangerSection
  return letter
}
