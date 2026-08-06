"use client"

/**
 * Web MIDI output sink for the Jam Player.
 *
 * Companion to lib/band-jam/engine/player.ts (the browser-sampler sink).
 * Both consume the same Arrangement/NoteEvent stream -- see
 * docs/jam-player-voice-engine.md sections 2 and 4 ("one event stream, two
 * sinks"). This file is the second sink: it drives a real Yamaha keyboard
 * over Web MIDI instead of (or alongside) the AudioWorklet sampler.
 *
 * Two things worth knowing before editing:
 *
 * 1. NOTES ABOVE FX_PITCH_MIN (83) PASS THROUGH UNCHANGED. On MegaVoice,
 *    those notes trigger real ROM articulations (fret noise, strum noise,
 *    etc.) on the hardware -- that is the entire point of this sink. Never
 *    filter, transpose, or velocity-remap them here. See
 *    lib/band-jam/engine/types.ts and megavoice-map.ts for the source rule.
 *
 * 2. TWO CLOCKS. BandPlayer schedules in AudioContext.currentTime (seconds).
 *    Web MIDI's MIDIOutput.send(data, timestamp) wants a DOMHighResTimeStamp
 *    in performance.now() (ms) space. MidiScheduler reuses BandPlayer's exact
 *    beat<->ctxTime math (so both sinks agree on where "now" is musically),
 *    then converts to the MIDI clock only at the point of sending. See
 *    `midiTimestamp` below for the conversion and its assumptions.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  BEATS_PER_BAR,
  type Arrangement,
  type BandPart,
  type LoopRange,
  type NoteEvent,
  type TransportStatus,
} from "@/lib/band-jam/engine/types"
// Shared loop and event-window math keeps both sinks aligned exactly.
import {
  buildArrangementEventIndex,
  loopToBeats,
  scheduledEventsForSpan,
  type IndexedPartEvents,
} from "@/lib/band-jam/engine/timeline-index"

// ---------------------------------------------------------------------------
// Raw MIDI bytes
// ---------------------------------------------------------------------------

const NOTE_ON = 0x90
const NOTE_OFF = 0x80
const CONTROL_CHANGE = 0xb0
const PROGRAM_CHANGE = 0xc0
const CC_BANK_SELECT_MSB = 0
const CC_BANK_SELECT_LSB = 32
const CC_ALL_NOTES_OFF = 123

function clampChannel(channel: number): number {
  return Math.max(0, Math.min(15, Math.trunc(channel)))
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(127, Math.trunc(value)))
}

// ---------------------------------------------------------------------------
// MidiOut -- thin wrapper around the Web MIDI API
// ---------------------------------------------------------------------------

export type MidiOutputInfo = {
  id: string
  name: string
}

/**
 * Wraps a single selected MIDIOutput port. Doesn't request MIDIAccess on
 * construction -- that must happen from a user gesture (browsers reject
 * `requestMIDIAccess()` otherwise), so callers (typically `useMidiOut`)
 * request it explicitly and hand it in via `useAccess()`. This also keeps
 * the class trivially testable: tests hand in a fake MIDIAccess instead of
 * touching `navigator`.
 */
export class MidiOut {
  private access: MIDIAccess | null = null
  private output: MIDIOutput | null = null
  private outputId: string | null = null

  static isSupported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.requestMIDIAccess === "function"
    )
  }

  /**
   * No sysex: the Jam Player never needs it, and requesting it makes the
   * browser show a scarier permission prompt for no benefit.
   */
  static async requestAccess(): Promise<MIDIAccess> {
    if (!MidiOut.isSupported()) {
      throw new Error("Web MIDI is not supported in this browser.")
    }
    return navigator.requestMIDIAccess({ sysex: false })
  }

  /** Adopt an already-granted MIDIAccess (from `requestAccess()`, or a fake
   *  one in tests). Re-selects the previously chosen output id, if any, so
   *  a re-grant (e.g. after `onstatechange`) doesn't drop the selection. */
  useAccess(access: MIDIAccess) {
    this.access = access
    if (this.outputId) this.selectOutput(this.outputId)
  }

  listOutputs(): MidiOutputInfo[] {
    const out: MidiOutputInfo[] = []
    this.access?.outputs.forEach((port) => {
      out.push({ id: port.id, name: port.name ?? port.id })
    })
    return out
  }

  /** Returns true if `id` matched a currently available output. */
  selectOutput(id: string): boolean {
    let found: MIDIOutput | null = null
    this.access?.outputs.forEach((port) => {
      if (port.id === id) found = port
    })
    this.output = found
    this.outputId = id
    return found !== null
  }

  getSelectedOutputId(): string | null {
    return this.output ? this.outputId : null
  }

  clearOutput() {
    this.output = null
    this.outputId = null
  }

  // -- sending ---------------------------------------------------------------

  sendNoteOn(
    channel: number,
    note: number,
    velocity: number,
    timestamp?: number,
  ) {
    this.send(
      [NOTE_ON | clampChannel(channel), clampByte(note), clampByte(velocity)],
      timestamp,
    )
  }

  sendNoteOff(
    channel: number,
    note: number,
    velocity = 0,
    timestamp?: number,
  ) {
    this.send(
      [NOTE_OFF | clampChannel(channel), clampByte(note), clampByte(velocity)],
      timestamp,
    )
  }

  /** CC 123 (all notes off) on `channel`. Does not touch bank/program. */
  allNotesOff(channel: number, timestamp?: number) {
    this.send(
      [CONTROL_CHANGE | clampChannel(channel), CC_ALL_NOTES_OFF, 0],
      timestamp,
    )
  }

  /**
   * Bank-select + Program Change, sent in the order hardware requires:
   * MSB, then LSB, then Program Change.
   *
   * `program` is the 0-127 MIDI program value -- NOT the desktop app's
   * 1-128 PRG number. `SmartBridge/Source/Piano/InstrumentController.cpp`
   * (`SetVoice`) stores voices as PRG 1-128 and does `pc = prg - 1` before
   * sending; do that conversion yourself before calling this if you're
   * starting from a 1-128 PRG value. `pc0` in `megavoice-map.ts` is already
   * the 0-127 value this function wants -- pass it straight through.
   * Passing a raw 1-128 PRG number here silently selects the wrong (or an
   * out-of-range) voice.
   */
  selectVoice(
    channel: number,
    msb: number,
    lsb: number,
    program: number,
    timestamp?: number,
  ) {
    const ch = clampChannel(channel)
    this.send([CONTROL_CHANGE | ch, CC_BANK_SELECT_MSB, clampByte(msb)], timestamp)
    this.send([CONTROL_CHANGE | ch, CC_BANK_SELECT_LSB, clampByte(lsb)], timestamp)
    this.send([PROGRAM_CHANGE | ch, clampByte(program)], timestamp)
  }

  private send(data: number[], timestamp?: number) {
    this.output?.send(data, timestamp)
  }
}

// ---------------------------------------------------------------------------
// Yamaha style channel assignment
// ---------------------------------------------------------------------------

/**
 * Yamaha style part -> MIDI channel (0-indexed). Matches the style-file
 * convention the arrangement data was authored against: drums=9 (the GM
 * percussion channel -- correct, not a bug), bass=10, guitar=11, keys=12,
 * solo=14. Channel 13 is intentionally skipped, per the same convention.
 *
 * Tunable: pass overrides via `MidiSchedulerOptions.channels` rather than
 * mutating this map, so the default stays a reliable reference.
 */
export const STYLE_MIDI_CHANNELS: Record<BandPart, number> = {
  drums: 9,
  bass: 10,
  guitar: 11,
  keys: 12,
  solo: 14,
}

// ---------------------------------------------------------------------------
// MidiScheduler -- consumes an Arrangement, emits timed MIDI
// ---------------------------------------------------------------------------

export type MidiSchedulerOptions = {
  /** Seconds of MIDI scheduled in advance. Mirrors BandPlayer's
   *  scheduleAheadSec so both sinks look the same distance into the future. */
  scheduleAheadSec?: number
  /** Scheduler wake interval in ms. Must be well under scheduleAheadSec. */
  tickMs?: number
  /** Per-part channel overrides; unset parts fall back to
   *  STYLE_MIDI_CHANNELS. */
  channels?: Partial<Record<BandPart, number>>
  /** Scheduling latency pad added ahead of `play()`'s origin, in seconds.
   *  Exposed (rather than hardcoded) so tests can zero it for simpler math. */
  startLatencySec?: number
  onStatus?: (status: TransportStatus) => void
  /** Fires when the loop wraps, for UI -- mirrors BandPlayer's onLoopWrap. */
  onLoopWrap?: () => void
}

const DEFAULT_AHEAD = 0.25
const DEFAULT_TICK = 40
const DEFAULT_START_LATENCY = 0.06

/**
 * Look-ahead MIDI scheduler. Deliberately mirrors BandPlayer's transport
 * (play/pause/stop/setTempo/setLoop/seekToBar) and its beat<->ctxTime
 * formulas beat-for-beat, so a caller driving both sinks from the same UI
 * actions gets a MIDI stream that lines up with the audio. Event-window and
 * loop recurrence logic is shared through timeline-index.ts; only the final
 * AudioContext-time -> DOMHighResTimeStamp conversion remains MIDI-specific.
 */
export class MidiScheduler {
  private arrangement: Arrangement | null = null
  private eventIndex: IndexedPartEvents[] = []
  private status: TransportStatus = "idle"

  private tempo = 100
  private secPerBeat = 0.6
  /** Time origin for the beat<->time mapping; rebased on tempo change,
   *  exactly like BandPlayer. */
  private originTime = 0
  private originBeat = 0
  private cursorBeat = 0
  private loop: LoopRange | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  private readonly channels: Record<BandPart, number>
  private disabledParts = new Set<BandPart>()
  /** Channels that have actually had a note-on sent since the last
   *  setArrangement(). allNotesOff-on-stop/pause/loop-wrap only touches
   *  these, not every channel in STYLE_MIDI_CHANNELS. */
  private usedChannels = new Set<number>()

  private countInBars = 0
  private countInUntilBeat = 0

  /** performance.now() - ctx.currentTime*1000, sampled once per play(). See
   *  `midiTimestamp` for why a single offset is correct here. */
  private clockOffsetMs = 0

  constructor(
    private readonly ctx: AudioContext,
    private readonly midiOut: MidiOut,
    private readonly options: MidiSchedulerOptions = {},
  ) {
    this.channels = { ...STYLE_MIDI_CHANNELS, ...options.channels }
    this.syncClock()
  }

  // -- wiring -----------------------------------------------------------

  setArrangement(arrangement: Arrangement) {
    // Mirror BandPlayer: hot-swap keeps the playhead and skips count-in.
    // stop()+play() from bar 0 re-armed the lead-in mid-song whenever the
    // React arrangement object was rebuilt (key / variation / tempo).
    const wasPlaying = this.status === "playing"
    const preservedBeat = wasPlaying
      ? this.toArrangementBeat(
          Math.max(0, this.playbackBeatAt(this.ctx.currentTime)),
        )
      : this.cursorBeat

    if (wasPlaying) {
      this.clearTimer()
      this.silenceUsedChannels(this.ctx.currentTime)
    } else {
      this.silenceUsedChannels(this.ctx.currentTime)
    }

    this.arrangement = arrangement
    this.eventIndex = buildArrangementEventIndex(arrangement)
    this.usedChannels.clear()

    const total = arrangement.totalBeats
    this.cursorBeat =
      total > 0 ? Math.min(Math.max(0, preservedBeat), Math.max(0, total - 1e-9)) : 0

    if (!wasPlaying) {
      this.setTempo(arrangement.tempo)
      if (this.status !== "idle") this.setStatus("ready")
      return
    }

    const savedCountIn = this.countInBars
    this.countInBars = 0
    void this.play()
    this.countInBars = savedCountIn
  }

  /** Per-part enable/disable, so a user can send only the parts they want
   *  to the keyboard. All parts are enabled by default. */
  setPartEnabled(part: BandPart, enabled: boolean) {
    if (enabled) this.disabledParts.delete(part)
    else this.disabledParts.add(part)
    if (!enabled && this.status === "playing") {
      // Cut anything already sounding on that channel rather than waiting
      // out its natural note-off.
      const ch = this.channelFor(part)
      this.midiOut.allNotesOff(ch, this.midiTimestamp(this.ctx.currentTime))
    }
  }

  isPartEnabled(part: BandPart): boolean {
    return !this.disabledParts.has(part)
  }

  private channelFor(part: BandPart): number {
    return this.channels[part]
  }

  // -- transport ------------------------------------------------------------

  private setStatus(s: TransportStatus) {
    this.status = s
    this.options.onStatus?.(s)
  }

  getStatus() {
    return this.status
  }

  /** Rebase the beat<->time origin so a tempo change takes effect from now
   *  without disturbing what has already been scheduled -- same rule as
   *  BandPlayer.setTempo. */
  setTempo(bpm: number) {
    const clamped = Math.max(20, Math.min(300, bpm))
    if (this.status === "playing") {
      const beatNow = this.playbackBeatAt(this.ctx.currentTime)
      this.originBeat = beatNow
      this.originTime = this.ctx.currentTime
    }
    this.tempo = clamped
    this.secPerBeat = 60 / clamped
  }

  getTempo() {
    return this.tempo
  }

  setLoop(loop: LoopRange | null) {
    this.loop = loop
    if (loop && this.status === "playing") {
      const arrangementBeat = this.toArrangementBeat(
        this.playbackBeatAt(this.ctx.currentTime),
      )
      const { start, end } = loopToBeats(loop)
      if (arrangementBeat < start || arrangementBeat >= end) {
        this.seekToBar(loop.startBar)
      }
    }
  }

  getLoop() {
    return this.loop
  }

  setCountInBars(bars: number) {
    this.countInBars = Math.max(0, Math.min(4, Math.floor(bars)))
  }

  seekToBar(bar: number) {
    const beat = Math.max(0, (bar - 1) * BEATS_PER_BAR)
    const wasPlaying = this.status === "playing"
    this.silenceUsedChannels(this.ctx.currentTime)
    this.cursorBeat = beat
    if (wasPlaying) {
      this.originBeat = beat
      this.originTime = this.ctx.currentTime
      this.countInUntilBeat = beat
    }
  }

  async play() {
    if (!this.arrangement) return
    if (this.status === "playing") return
    if (this.ctx.state === "suspended") await this.ctx.resume()
    this.syncClock()

    const startBeat = this.cursorBeat
    const latency = this.options.startLatencySec ?? DEFAULT_START_LATENCY
    this.originTime = this.ctx.currentTime + latency
    // Same count-in origin as BandPlayer: notes must not fire while the
    // audio sink is still clicking through the lead-in.
    this.originBeat = startBeat - this.countInBars * BEATS_PER_BAR
    this.countInUntilBeat = startBeat
    this.cursorBeat = this.originBeat

    this.setStatus("playing")
    this.timer = setInterval(
      () => this.tick(),
      this.options.tickMs ?? DEFAULT_TICK,
    )
    this.tick()
  }

  pause() {
    if (this.status !== "playing") return
    const beat = this.toArrangementBeat(
      Math.max(0, this.playbackBeatAt(this.ctx.currentTime)),
    )
    this.clearTimer()
    this.silenceUsedChannels(this.ctx.currentTime)
    this.cursorBeat = beat
    this.setStatus("ready")
  }

  stop() {
    this.clearTimer()
    this.silenceUsedChannels(this.ctx.currentTime)
    this.cursorBeat = 0
    if (this.status !== "idle") this.setStatus("ready")
  }

  dispose() {
    this.stop()
    this.eventIndex = []
    this.setStatus("idle")
  }

  private clearTimer() {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** allNotesOff on every channel that has actually sounded a note. Called
   *  on stop/pause/seek/loop-wrap so nothing hangs -- see `scheduleNote`
   *  for why this is a necessary second layer, not a redundant one. */
  private silenceUsedChannels(ctxTime: number) {
    const ts = this.midiTimestamp(ctxTime)
    for (const ch of this.usedChannels) {
      this.midiOut.allNotesOff(ch, ts)
    }
  }

  // -- beat <-> time, mirrors BandPlayer -------------------------------------

  private loopBeatsRange(): { start: number; end: number } | null {
    if (!this.loop || !this.arrangement) return null
    const { start, end } = loopToBeats(this.loop)
    if (end - start < 1) return null
    return { start, end }
  }

  private playbackBeatAt(time: number): number {
    return this.originBeat + (time - this.originTime) / this.secPerBeat
  }

  private beatToTime(playbackBeat: number): number {
    return this.originTime + (playbackBeat - this.originBeat) * this.secPerBeat
  }

  /** Fold a monotonic playback beat into the arrangement, honouring the
   *  loop -- identical to BandPlayer.toArrangementBeat. */
  private toArrangementBeat(playbackBeat: number): number {
    const total = this.arrangement?.totalBeats ?? 0
    const lp = this.loopBeatsRange()
    if (lp) {
      if (playbackBeat < lp.start) return playbackBeat
      const len = lp.end - lp.start
      return lp.start + ((playbackBeat - lp.start) % len)
    }
    if (total > 0) return playbackBeat % total
    return playbackBeat
  }

  /** Playhead in arrangement beats, for UI that wants to show MIDI-sink
   *  position independent of the sampler. */
  getCurrentBeat(): number {
    if (this.status !== "playing") return this.toArrangementBeat(this.cursorBeat)
    const pb = this.playbackBeatAt(this.ctx.currentTime)
    if (pb < this.countInUntilBeat) {
      return this.toArrangementBeat(this.countInUntilBeat)
    }
    return this.toArrangementBeat(Math.max(0, pb))
  }

  isCountingIn(): boolean {
    if (this.status !== "playing") return false
    return this.playbackBeatAt(this.ctx.currentTime) < this.countInUntilBeat
  }

  /**
   * AudioContext.currentTime (seconds, arbitrary origin) and
   * performance.now() (ms, page-load origin) are different clocks. Web
   * MIDI's `send(data, timestamp)` wants the latter; every beat<->time
   * computation above -- mirroring BandPlayer -- lives in the former,
   * because that's the clock the audio graph actually runs on.
   *
   * Both clocks are monotonic and, for a real-time AudioContext in a
   * spec-compliant browser, tick at the same rate (the Web Audio spec ties
   * a real-time context's clock to the same timeline performance.now()
   * uses). So one additive offset, sampled once, converts between them:
   *
   *   offsetMs = performance.now() - ctx.currentTime * 1000
   *   midiTimestampMs(ctxTime) = offsetMs + ctxTime * 1000
   *
   * The offset is re-sampled on every `play()` (not just at construction)
   * because `ctx.currentTime` freezes while the context is suspended, which
   * would otherwise let the two clocks drift apart across a pause. Getting
   * this wrong is silent: MIDI notes fire at the wrong wall-clock time
   * while every internal computation still looks perfectly scheduled in
   * ctx-time -- exactly the drift this sink exists to avoid.
   */
  private syncClock() {
    this.clockOffsetMs = performance.now() - this.ctx.currentTime * 1000
  }

  private midiTimestamp(ctxTime: number): number {
    return this.clockOffsetMs + ctxTime * 1000
  }

  // -- scheduling -------------------------------------------------------------

  /**
   * Public so a caller -- or a test -- can drive the scheduler directly
   * instead of waiting on the internal setInterval (e.g. from a rAF loop,
   * or by advancing a fake AudioContext clock in tests). The interval
   * timer just calls this on a cadence; calling it early or extra times is
   * harmless, it only ever schedules events whose time has come.
   */
  tick() {
    if (!this.arrangement || this.status !== "playing") return
    const ahead = this.options.scheduleAheadSec ?? DEFAULT_AHEAD
    const horizonBeat = this.playbackBeatAt(this.ctx.currentTime + ahead)
    const lp = this.loopBeatsRange()

    while (this.cursorBeat < horizonBeat) {
      const chunkEnd = Math.min(this.cursorBeat + BEATS_PER_BAR, horizonBeat)
      this.scheduleSpan(this.cursorBeat, chunkEnd)
      if (lp) {
        // Same pass-count seam as BandPlayer: a 1-bar loop folds cursorBeat
        // and chunkEnd to the same arrangement beat, so `next < prev` never
        // fires.
        const len = lp.end - lp.start
        const passBefore = Math.floor((this.cursorBeat - lp.start) / len)
        const passAfter = Math.floor((chunkEnd - lp.start) / len)
        if (passAfter > passBefore) {
          this.silenceUsedChannels(this.beatToTime(chunkEnd))
          this.options.onLoopWrap?.()
        }
      }
      this.cursorBeat = chunkEnd
    }
  }

  /** Schedule every note whose start lies in [fromBeat, toBeat). */
  private scheduleSpan(fromBeat: number, toBeat: number) {
    const arr = this.arrangement
    if (!arr) return

    const noteFromBeat = Math.max(fromBeat, this.countInUntilBeat)
    if (toBeat <= noteFromBeat) return

    for (const { part, events } of this.eventIndex) {
      if (this.disabledParts.has(part)) continue
      const channel = this.channelFor(part)
      const scheduled = scheduledEventsForSpan(
        events,
        noteFromBeat,
        toBeat,
        arr.totalBeats,
        this.loop,
      )
      for (const { event, playbackBeat } of scheduled) {
        this.scheduleNote(channel, event, playbackBeat)
      }
    }
  }

  /**
   * Sends the note-on AND its matching note-off together, both timestamped
   * up front -- the Web MIDI equivalent of BandPlayer scheduling an
   * AudioBufferSourceNode's start() and stop() in one call. Web MIDI has no
   * "cancel a queued message" API, so deferring the note-off to be sent
   * "when it's due" would risk it never being sent at all if playback is
   * torn down first. Pairing them at schedule time guarantees every
   * note-on this sink ever emits already has a matching note-off queued.
   *
   * `stop()`/`pause()`/`seekToBar()`/loop-wrap additionally force an
   * immediate CC123 (see `silenceUsedChannels`) so the user gets silence
   * right away instead of waiting out a long note's full scheduled length
   * -- that immediacy is the real hung-note protection; the pairing here
   * is what makes sure a note-off is queued at all.
   *
   * Notes above FX_PITCH_MIN (83) are MegaVoice noise-layer triggers, not
   * pitches -- `ev.note` is passed straight through, deliberately never
   * transformed here. That is the entire point of this sink.
   */
  private scheduleNote(channel: number, ev: NoteEvent, playbackBeat: number) {
    const onCtxTime = this.beatToTime(playbackBeat)
    if (onCtxTime < this.ctx.currentTime - 0.02) return

    const durSec = Math.max(0.02, ev.durationBeats * this.secPerBeat)
    const offCtxTime = onCtxTime + durSec

    this.midiOut.sendNoteOn(channel, ev.note, ev.velocity, this.midiTimestamp(onCtxTime))
    this.midiOut.sendNoteOff(channel, ev.note, 0, this.midiTimestamp(offCtxTime))
    this.usedChannels.add(channel)
  }
}

// ---------------------------------------------------------------------------
// useMidiOut -- React binding
// ---------------------------------------------------------------------------

export type MidiOutStatus = "idle" | "requesting" | "ready" | "denied" | "error"

export type UseMidiOutResult = {
  /** False on browsers without the Web MIDI API (Safari, most of iOS). */
  supported: boolean
  status: MidiOutStatus
  error: string | null
  outputs: MidiOutputInfo[]
  selectedOutputId: string | null
  /** Must be called from a user gesture (e.g. a button click handler) --
   *  browsers reject requestMIDIAccess() otherwise. */
  requestAccess: () => Promise<void>
  selectOutput: (id: string | null) => void
  /** Whether the MIDI sink should run at all, independent of device
   *  selection -- lets a caller keep a device chosen while toggling MIDI
   *  output on/off (e.g. alongside the browser sampler). */
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  /** Stable across renders; hand this straight to
   *  `new MidiScheduler(ctx, midiOut)`. */
  midiOut: MidiOut
}

export function useMidiOut(): UseMidiOutResult {
  const midiOutRef = useRef<MidiOut | null>(null)
  if (!midiOutRef.current) midiOutRef.current = new MidiOut()

  const [supported] = useState(() => MidiOut.isSupported())
  const [status, setStatus] = useState<MidiOutStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<MidiOutputInfo[]>([])
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null)
  const [enabled, setEnabledState] = useState(false)

  const refreshOutputs = useCallback(() => {
    setOutputs(midiOutRef.current!.listOutputs())
  }, [])

  const requestAccess = useCallback(async () => {
    if (!supported) {
      setStatus("error")
      setError("Web MIDI is not supported in this browser.")
      return
    }
    setStatus("requesting")
    setError(null)
    try {
      const access = await MidiOut.requestAccess()
      midiOutRef.current!.useAccess(access)
      access.onstatechange = () => refreshOutputs()
      refreshOutputs()
      setStatus("ready")
    } catch (err) {
      const denied = err instanceof DOMException && err.name === "SecurityError"
      setStatus(denied ? "denied" : "error")
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [supported, refreshOutputs])

  const selectOutput = useCallback((id: string | null) => {
    setSelectedOutputId(id)
    if (id) midiOutRef.current!.selectOutput(id)
    else midiOutRef.current!.clearOutput()
  }, [])

  const setEnabled = useCallback((v: boolean) => setEnabledState(v), [])

  useEffect(() => {
    const out = midiOutRef.current
    return () => {
      out?.clearOutput()
    }
  }, [])

  return {
    supported,
    status,
    error,
    outputs,
    selectedOutputId,
    requestAccess,
    selectOutput,
    enabled,
    setEnabled,
    midiOut: midiOutRef.current,
  }
}
