import {
  regionSliceSeconds,
  type LoadedSample,
  type SampleBank,
} from "@/lib/band-jam/engine/sample-bank"
import type { EffectsRack } from "@/lib/band-jam/engine/effects"
import {
  BEATS_PER_BAR,
  type Arrangement,
  type BandPart,
  type LoopRange,
  type NoteEvent,
  type SfzRegion,
  type TransportStatus,
} from "@/lib/band-jam/engine/types"

/**
 * Multi-part sample playback with a look-ahead scheduler.
 *
 * Two decisions worth knowing before editing:
 *
 * 1. MUTE IS A GAIN NODE, never a source stop. The pilot's StemPlayer stopped
 *    and restarted every source on each mute toggle, which clicks and shifts
 *    timing. Here each part owns a GainNode and mute just rides it, so parts
 *    stay in sync whatever the user toggles.
 *
 * 2. VELOCITY IS NEVER SCALED. On MegaVoice, velocity selects articulation
 *    rather than loudness — a "quieter" velocity is a different recording
 *    (dead note vs. sustain). Level changes go through the part gain; density
 *    changes go through clip substitution upstream. See
 *    docs/jam-player-voice-engine.md section 3.3.
 */

/** Region lookup, injected so this file does not depend on the SFZ parser. */
export type RegionSelector = {
  selectRegion(note: number, velocity: number): SfzRegion | null
  regionGain(region: SfzRegion, velocity: number): number
  playbackRateFor(region: SfzRegion, note: number): number
}

export type PartVoiceSource = {
  selector: RegionSelector
  bank: SampleBank
}

export type BandPlayerOptions = {
  /** Seconds of audio scheduled in advance. */
  scheduleAheadSec?: number
  /** Scheduler wake interval in ms. Must be well under scheduleAheadSec. */
  tickMs?: number
  onStatus?: (status: TransportStatus) => void
  /** Fires when the loop wraps, for UI. */
  onLoopWrap?: () => void
  /**
   * Optional mix bus. When present, each part routes
   * partGain -> EQ -> comp -> master/reverb instead of straight to master.
   * Absent, the graph is exactly as before — effects are additive, never a
   * precondition for audio.
   */
  effects?: EffectsRack
}

const DEFAULT_AHEAD = 0.25
const DEFAULT_TICK = 40
/** Guard against a runaway note choking the graph. */
const MAX_NOTE_SECONDS = 12

export class BandPlayer {
  private master: GainNode
  private partGains = new Map<BandPart, GainNode>()
  private sources = new Map<BandPart, PartVoiceSource>()
  private active: {
    node: AudioBufferSourceNode
    gain: GainNode
    endAt: number
  }[] = []

  private arrangement: Arrangement | null = null
  private status: TransportStatus = "idle"

  private tempo = 100
  private secPerBeat = 0.6
  /** Time origin for the beat<->time mapping; rebased on tempo change. */
  private originTime = 0
  private originBeat = 0
  /** Monotonic playback beat already handed to the scheduler. */
  private cursorBeat = 0
  private loop: LoopRange | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  private muted = new Set<BandPart>()
  private volumes = new Map<BandPart, number>()
  /**
   * Whole-instrument level match, measured offline (EBU R128) and shipped in
   * manifest.json. Piano sat 5.95 dB below the other instruments. Kept
   * SEPARATE from user volume so the two compose instead of overwriting each
   * other — the user's fader stays 0-1 and means what it says.
   */
  private instrumentGains = new Map<BandPart, number>()

  private metronomeOn = false
  private countInBars = 0
  private countInUntilBeat = 0

  constructor(
    private readonly ctx: AudioContext,
    private readonly options: BandPlayerOptions = {},
  ) {
    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(ctx.destination)
  }

  // -- wiring ---------------------------------------------------------------

  registerPart(part: BandPart, source: PartVoiceSource, settings?: unknown) {
    this.sources.set(part, source)
    if (this.partGains.has(part)) {
      // The chain already exists — but it carries the STYLE's EQ, compression
      // and amp rig, and the style may have changed since it was built.
      // Returning early here froze a part's effects at whatever the first
      // style of the session used, so loading rock once left every style
      // afterwards playing through rock's distortion. applyPreset() does not
      // cover this: it only updates the reverb and the master bus.
      this.updatePartEffects(part, settings)
      return
    }

    const rack = this.options.effects
    if (rack) {
      // The chain's input gain IS the part gain, so mute silences the reverb
      // send too — a muted part must not keep feeding the tail.
      const chain = rack.createPartChain(
        part,
        (settings as Parameters<EffectsRack["createPartChain"]>[1]) ?? undefined,
      )
      chain.gain.gain.value = this.gainValueFor(part)
      this.partGains.set(part, chain.gain)
      return
    }

    const g = this.ctx.createGain()
    g.gain.value = this.gainValueFor(part)
    g.connect(this.master)
    this.partGains.set(part, g)
  }

  /**
   * Rebuild one part's effect chain in place, keeping its current mix state.
   *
   * createPartChain disposes the previous chain for this part, and voices are
   * looked up through partGains at schedule time, so swapping the node is
   * safe. Notes already scheduled into the old chain are cut — acceptable,
   * since this only runs on a style change, which reloads the instruments too.
   */
  updatePartEffects(part: BandPart, settings?: unknown) {
    const rack = this.options.effects
    if (!rack) return
    const chain = rack.createPartChain(
      part,
      (settings as Parameters<EffectsRack["createPartChain"]>[1]) ?? undefined,
    )
    chain.gain.gain.value = this.gainValueFor(part)
    this.partGains.set(part, chain.gain)
  }

  setArrangement(arrangement: Arrangement) {
    // Hot-swap must NOT stop()+play() from bar 0 with a fresh count-in.
    // Practice-screen rebuilds the arrangement on key/variation (and used
    // to on every tempo tick); restarting from the top made the band jump
    // back to the first count-in mid-song — often right as the next section
    // arrived.
    const wasPlaying = this.status === "playing"
    const preservedBeat = wasPlaying
      ? this.toArrangementBeat(
          Math.max(0, this.playbackBeatAt(this.ctx.currentTime)),
        )
      : this.cursorBeat

    if (wasPlaying) {
      this.clearTimer()
      this.stopVoices()
    } else {
      this.stopVoices()
    }

    this.arrangement = arrangement

    // Drop any part the new arrangement does not contain. `sources` and
    // `partGains` outlive a style change, so a voice registered by an earlier
    // style stays wired to the master bus and is ready to play the moment
    // anything schedules into it. Belt and braces: the arrangement is already
    // filtered upstream, but nothing should be able to sound a part the
    // current arrangement does not have.
    const live = new Set(arrangement.parts.map((p) => p.part))
    for (const part of [...this.partGains.keys()]) {
      if (live.has(part)) continue
      this.partGains.get(part)?.disconnect()
      this.partGains.delete(part)
      this.sources.delete(part)
    }

    const total = arrangement.totalBeats
    this.cursorBeat =
      total > 0 ? Math.min(Math.max(0, preservedBeat), Math.max(0, total - 1e-9)) : 0

    if (!wasPlaying) {
      this.setTempo(arrangement.tempo)
      if (this.status !== "idle") this.setStatus("ready")
      return
    }

    // Resume in place — keep the live tempo and skip count-in.
    const savedCountIn = this.countInBars
    this.countInBars = 0
    void this.play()
    this.countInBars = savedCountIn
  }

  // -- mix ------------------------------------------------------------------

  private gainValueFor(part: BandPart): number {
    if (this.muted.has(part)) return 0
    return (this.volumes.get(part) ?? 1) * (this.instrumentGains.get(part) ?? 1)
  }

  /** Linear multiplier from LoadedInstrument.instrumentGain. */
  setInstrumentGain(part: BandPart, gain: number) {
    this.instrumentGains.set(part, Math.max(0, gain))
    this.applyGain(part)
  }

  private applyGain(part: BandPart) {
    const g = this.partGains.get(part)
    if (!g) return
    const now = this.ctx.currentTime
    // Short ramp: instant enough to feel immediate, long enough not to click.
    g.gain.cancelScheduledValues(now)
    g.gain.setTargetAtTime(this.gainValueFor(part), now, 0.015)
  }

  setMuted(part: BandPart, muted: boolean) {
    if (muted) this.muted.add(part)
    else this.muted.delete(part)
    this.applyGain(part)
  }

  isMuted(part: BandPart) {
    return this.muted.has(part)
  }

  setVolume(part: BandPart, volume: number) {
    this.volumes.set(part, Math.max(0, Math.min(1, volume)))
    this.applyGain(part)
  }

  setMasterVolume(v: number) {
    const now = this.ctx.currentTime
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), now, 0.015)
  }

  // -- transport ------------------------------------------------------------

  private setStatus(s: TransportStatus) {
    this.status = s
    this.options.onStatus?.(s)
  }

  getStatus() {
    return this.status
  }

  /**
   * Rebase the beat<->time origin so a tempo change takes effect from now
   * without disturbing what has already been scheduled.
   */
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
    if (!loop || this.status !== "playing") return
    // If the playhead is already inside the new loop, leave it alone so a
    // pause/resume that re-applies the same loop does not yank back to bar 1.
    // Callers that mean "play this section from the top" seek explicitly.
    const arrangementBeat = this.toArrangementBeat(
      this.playbackBeatAt(this.ctx.currentTime),
    )
    const startBeat = (loop.startBar - 1) * BEATS_PER_BAR
    const endBeat = loop.endBar * BEATS_PER_BAR
    if (arrangementBeat < startBeat || arrangementBeat >= endBeat) {
      this.seekToBar(loop.startBar)
    }
  }

  getLoop() {
    return this.loop
  }

  setMetronome(on: boolean) {
    this.metronomeOn = on
  }

  setCountInBars(bars: number) {
    this.countInBars = Math.max(0, Math.min(4, Math.floor(bars)))
  }

  private loopBeats(): { start: number; end: number } | null {
    if (!this.loop || !this.arrangement) return null
    const start = (this.loop.startBar - 1) * BEATS_PER_BAR
    const end = this.loop.endBar * BEATS_PER_BAR
    if (end - start < 1) return null
    return { start, end }
  }

  private playbackBeatAt(time: number): number {
    return this.originBeat + (time - this.originTime) / this.secPerBeat
  }

  private beatToTime(playbackBeat: number): number {
    return this.originTime + (playbackBeat - this.originBeat) * this.secPerBeat
  }

  /** Fold a monotonic playback beat into the arrangement, honouring the loop. */
  private toArrangementBeat(playbackBeat: number): number {
    const total = this.arrangement?.totalBeats ?? 0
    const lp = this.loopBeats()
    if (lp) {
      if (playbackBeat < lp.start) return playbackBeat
      const len = lp.end - lp.start
      return lp.start + ((playbackBeat - lp.start) % len)
    }
    if (total > 0) return playbackBeat % total
    return playbackBeat
  }

  /** Playhead in arrangement beats, for the chart. */
  getCurrentBeat(): number {
    if (this.status !== "playing") return this.toArrangementBeat(this.cursorBeat)
    const pb = this.playbackBeatAt(this.ctx.currentTime)
    // During count-in, park the chart on the musical start bar (e.g. a
    // clicked Chorus), not arrangement beat 0 — that looked like a jump
    // back to the top of the song.
    if (pb < this.countInUntilBeat) {
      return this.toArrangementBeat(this.countInUntilBeat)
    }
    return this.toArrangementBeat(Math.max(0, pb))
  }

  /** 1-indexed bar under the playhead. */
  getCurrentBar(): number {
    return Math.floor(this.getCurrentBeat() / BEATS_PER_BAR) + 1
  }

  isCountingIn(): boolean {
    if (this.status !== "playing") return false
    return this.playbackBeatAt(this.ctx.currentTime) < this.countInUntilBeat
  }

  seekToBar(bar: number) {
    const beat = Math.max(0, (bar - 1) * BEATS_PER_BAR)
    const wasPlaying = this.status === "playing"
    this.stopVoices()
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

    const startBeat = this.cursorBeat
    this.originTime = this.ctx.currentTime + 0.06
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
    this.stopVoices()
    this.cursorBeat = beat
    this.setStatus("ready")
  }

  stop() {
    this.clearTimer()
    this.stopVoices()
    this.cursorBeat = 0
    if (this.status !== "idle") this.setStatus("ready")
  }

  private clearTimer() {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  // -- scheduling -----------------------------------------------------------

  private tick() {
    if (!this.arrangement || this.status !== "playing") return
    const ahead = this.options.scheduleAheadSec ?? DEFAULT_AHEAD
    const horizonBeat = this.playbackBeatAt(this.ctx.currentTime + ahead)
    const lp = this.loopBeats()

    while (this.cursorBeat < horizonBeat) {
      const chunkEnd = Math.min(this.cursorBeat + BEATS_PER_BAR, horizonBeat)
      this.scheduleSpan(this.cursorBeat, chunkEnd)
      if (lp) {
        // Count completed passes rather than comparing folded beats: for a
        // 1-bar loop, cursorBeat 0 and chunkEnd 4 both fold to 0, so the old
        // `next < prev` test never fired.
        const len = lp.end - lp.start
        const passBefore = Math.floor((this.cursorBeat - lp.start) / len)
        const passAfter = Math.floor((chunkEnd - lp.start) / len)
        if (passAfter > passBefore) this.options.onLoopWrap?.()
      }
      this.cursorBeat = chunkEnd
    }

    this.reapVoices()
  }

  /** Schedule every note whose start lies in [fromBeat, toBeat). */
  private scheduleSpan(fromBeat: number, toBeat: number) {
    const arr = this.arrangement
    if (!arr) return

    for (const { part, events } of arr.parts) {
      const src = this.sources.get(part)
      const gain = this.partGains.get(part)
      if (!src || !gain) continue
      for (const ev of events) {
        const hits = this.playbackBeatsFor(ev.beat, fromBeat, toBeat)
        for (const pb of hits) this.scheduleNote(src, gain, ev, pb)
      }
    }

    if (this.metronomeOn || this.isCountInSpan(fromBeat)) {
      this.scheduleClicks(fromBeat, toBeat)
    }
  }

  private isCountInSpan(fromBeat: number) {
    return fromBeat < this.countInUntilBeat
  }

  /**
   * Map an arrangement beat to the playback beats inside [from, to).
   * With a loop active the same event recurs once per pass.
   */
  private playbackBeatsFor(
    eventBeat: number,
    fromBeat: number,
    toBeat: number,
  ): number[] {
    const arr = this.arrangement
    if (!arr) return []
    const lp = this.loopBeats()
    const period = lp ? lp.end - lp.start : arr.totalBeats
    if (period <= 0) return []

    const base = lp ? lp.start : 0
    if (lp && (eventBeat < lp.start || eventBeat >= lp.end)) return []

    const out: number[] = []
    const offsetInPeriod = eventBeat - base
    const firstPass = Math.floor((fromBeat - base - offsetInPeriod) / period)
    for (let k = firstPass; ; k += 1) {
      const pb = base + offsetInPeriod + k * period
      if (pb >= toBeat) break
      if (pb >= fromBeat && pb >= 0) out.push(pb)
      if (k > firstPass + 4) break
    }
    return out
  }

  private scheduleNote(
    src: PartVoiceSource,
    partGain: GainNode,
    ev: NoteEvent,
    playbackBeat: number,
  ) {
    const region = src.selector.selectRegion(ev.note, ev.velocity)
    if (!region) return
    const sample = src.bank.get(region.sample)
    if (!sample) return

    const when = this.beatToTime(playbackBeat)
    if (when < this.ctx.currentTime - 0.02) return

    const rate = src.selector.playbackRateFor(region, ev.note)
    const amp = src.selector.regionGain(region, ev.velocity)
    const { offsetSec, availableSec } = regionSliceSeconds(region, sample)
    if (availableSec <= 0) return

    // Note length in real seconds, capped by what the sample actually holds.
    const noteSec = ev.durationBeats * this.secPerBeat
    const playSec = Math.min(
      Math.max(0.02, noteSec),
      availableSec / rate,
      MAX_NOTE_SECONDS,
    )

    const node = this.ctx.createBufferSource()
    node.buffer = sample.buffer
    node.playbackRate.value = rate
    if (region.loop) node.loop = true

    const vGain = this.ctx.createGain()
    vGain.gain.value = amp
    node.connect(vGain)
    vGain.connect(partGain)

    const release = Math.max(0.005, region.ampegRelease || 0.02)
    const endAt = when + playSec
    vGain.gain.setValueAtTime(amp, Math.max(when, endAt - release))
    vGain.gain.linearRampToValueAtTime(0.0001, endAt + release)

    const stopAt = endAt + release + 0.01
    node.start(when, offsetSec, playSec + release)
    node.stop(stopAt)
    node.onended = () => {
      try {
        node.disconnect()
        vGain.disconnect()
      } catch {
        /* ignore */
      }
      // Drop the reference immediately. Waiting for the 64-voice reap threshold
      // meant sparse parts and short spans retained finished nodes until stop().
      const i = this.active.findIndex((v) => v.node === node)
      if (i !== -1) this.active.splice(i, 1)
    }
    this.active.push({ node, gain: vGain, endAt: stopAt })
  }

  private scheduleClicks(fromBeat: number, toBeat: number) {
    const first = Math.ceil(fromBeat)
    for (let b = first; b < toBeat; b += 1) {
      const when = this.beatToTime(b)
      if (when < this.ctx.currentTime) continue
      const arrangementBeat = this.toArrangementBeat(b)
      const downbeat = Math.abs(arrangementBeat % BEATS_PER_BAR) < 1e-6
      this.click(when, downbeat)
    }
  }

  private click(when: number, accent: boolean) {
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.frequency.value = accent ? 1600 : 1100
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.12, when + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05)
    osc.connect(g)
    // Straight to master: the click is a reference, not part of the music,
    // so it must not be reverbed or compressed with the band.
    g.connect(this.master)
    osc.start(when)
    osc.stop(when + 0.06)
  }

  /** Drop references to voices the graph has already finished with. */
  private reapVoices() {
    if (this.active.length < 64) return
    const now = this.ctx.currentTime
    this.active = this.active.filter((v) => v.endAt > now)
  }

  private stopVoices() {
    for (const { node, gain } of this.active) {
      node.onended = null
      try {
        node.stop()
      } catch {
        /* already stopped */
      }
      try {
        node.disconnect()
        gain.disconnect()
      } catch {
        /* ignore */
      }
    }
    this.active = []
  }

  dispose() {
    this.stop()
    this.partGains.forEach((g) => g.disconnect())
    this.partGains.clear()
    this.sources.clear()
    this.master.disconnect()
    this.setStatus("idle")
  }
}

/** Convenience: bars -> beats for loop maths outside the player. */
export function loopToBeats(loop: LoopRange): { start: number; end: number } {
  return {
    start: (loop.startBar - 1) * BEATS_PER_BAR,
    end: loop.endBar * BEATS_PER_BAR,
  }
}

export type { LoadedSample }
