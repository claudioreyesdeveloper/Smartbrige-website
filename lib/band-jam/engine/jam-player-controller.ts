import { BandPlayer } from "@/lib/band-jam/engine/player"
import { EffectsRack } from "@/lib/band-jam/engine/effects"
import { MidiScheduler } from "@/lib/band-jam/engine/web-midi"
import { effectivePartMuted } from "@/lib/band-jam/engine/playback-state"
import type {
  Arrangement,
  BandPart,
  LoopRange,
  PartMixState,
  TransportStatus,
} from "@/lib/band-jam/engine/types"

export const JAM_PLAYER_PARTS: BandPart[] = [
  "drums",
  "bass",
  "guitar",
  "keys",
  "solo",
]

export type PlaybackPassOptions = {
  startBar?: number
  resume: boolean
  range: LoopRange | null
  tempo: number
  countIn: boolean
  metronome: boolean
}

/**
 * Owns the live playback sinks and applies every transport/mix command to the
 * browser sampler and Web MIDI as one transaction. React owns declarative UI
 * state; this controller owns imperative audio state.
 */
export class JamPlayerController {
  private ctx: AudioContext | null = null
  private player: BandPlayer | null = null
  private effects: EffectsRack | null = null
  private midi: MidiScheduler | null = null
  private mix: Record<BandPart, PartMixState> | null = null
  private soloed: BandPart | null = null

  attachAudio(ctx: AudioContext, player: BandPlayer, effects: EffectsRack): void {
    const previousContext = this.ctx
    this.disposeAudio(false)
    if (previousContext && previousContext !== ctx && previousContext.state !== "closed") {
      void previousContext.close().catch((error) => {
        console.error("Previous AudioContext close failed", error)
      })
    }
    this.ctx = ctx
    this.player = player
    this.effects = effects
    if (this.mix) this.applyMixToOutputs()
  }

  attachMidi(scheduler: MidiScheduler | null): void {
    if (this.midi === scheduler) return
    this.midi?.dispose()
    this.midi = scheduler
    if (this.mix) this.applyMixToOutputs()
  }

  getContext(): AudioContext | null {
    return this.ctx
  }

  getPlayer(): BandPlayer | null {
    return this.player
  }

  getEffects(): EffectsRack | null {
    return this.effects
  }

  getMidiScheduler(): MidiScheduler | null {
    return this.midi
  }

  getStatus(): TransportStatus {
    return this.player?.getStatus() ?? "idle"
  }

  getCurrentBeat(): number {
    return this.player?.getCurrentBeat() ?? 0
  }

  getCurrentBar(): number | null {
    return this.player ? this.player.getCurrentBar() : null
  }

  isCountingIn(): boolean {
    return this.player?.isCountingIn() ?? false
  }

  getTempo(): number {
    return this.player?.getTempo() ?? 100
  }

  setMix(mix: Record<BandPart, PartMixState>): void {
    this.mix = mix
    this.applyMixToOutputs()
  }

  setSoloed(part: BandPart | null): void {
    this.soloed = part
    this.applyMixToOutputs()
  }

  setTempo(bpm: number): number {
    const next = Math.max(20, Math.min(300, bpm))
    this.player?.setTempo(next)
    this.midi?.setTempo(next)
    this.effects?.setTempo(next)
    return next
  }

  setMetronome(enabled: boolean): void {
    this.player?.setMetronome(enabled)
  }

  installPlaybackPass(
    arrangement: Arrangement,
    options: PlaybackPassOptions,
  ): void {
    const player = this.player
    if (!player) return

    player.pause()
    this.midi?.pause()

    player.setArrangement(arrangement)
    this.setTempo(options.tempo)
    player.setLoop(options.range)
    player.setCountInBars(options.countIn ? 1 : 0)
    player.setMetronome(options.metronome)
    this.applyMixToOutputs()
    if (options.startBar !== undefined) player.seekToBar(options.startBar)

    const midi = this.midi
    if (midi) {
      midi.setArrangement(arrangement)
      midi.setTempo(options.tempo)
      midi.setLoop(options.range)
      midi.setCountInBars(options.countIn ? 1 : 0)
      this.applyMixToOutputs()
      if (options.startBar !== undefined) midi.seekToBar(options.startBar)
      if (options.resume) void midi.play()
    }
    if (options.resume) void player.play()
  }

  pause(): void {
    this.player?.pause()
    this.midi?.pause()
  }

  stop(): void {
    this.player?.stop()
    this.midi?.stop()
  }

  disposeAudio(closeContext: boolean): void {
    this.player?.dispose()
    this.effects?.dispose()
    this.midi?.dispose()
    this.player = null
    this.effects = null
    this.midi = null

    if (closeContext) {
      const ctx = this.ctx
      this.ctx = null
      if (ctx && ctx.state !== "closed") {
        void ctx.close().catch((error) => {
          console.error("AudioContext close failed", error)
        })
      }
    }
  }

  dispose(): void {
    this.disposeAudio(true)
    this.mix = null
    this.soloed = null
  }

  private applyMixToOutputs(): void {
    const mix = this.mix
    if (!mix) return
    for (const part of JAM_PLAYER_PARTS) {
      const muted = effectivePartMuted(part, mix, this.soloed)
      this.player?.setMuted(part, muted)
      this.player?.setVolume(part, mix[part].volume)
      this.midi?.setPartEnabled(part, !muted)
    }
  }
}
