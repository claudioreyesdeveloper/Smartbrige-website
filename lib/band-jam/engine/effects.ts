import {
  ampModelMessage,
  fetchAmpModel,
  type AmpWeights,
} from "@/lib/band-jam/engine/amp/amp-models"
import type { BandPart } from "@/lib/band-jam/engine/types"

/**
 * Mix bus for the Jam Player.
 *
 * WHY THIS IS RUNTIME AND NOT BAKED INTO THE SAMPLES
 * --------------------------------------------------
 * Reverb and compression are BUS effects — they operate on the summed signal,
 * not on individual notes.
 *
 *  - Reverb tails must sum across notes and decay through the mix. A tail
 *    baked into each sample gives a 16th-note hi-hat pattern sixteen
 *    overlapping tails per bar. It is also incompatible with the build
 *    pipeline, which trims each sample to its decay and would cut the tail off.
 *  - Compression must react to the whole kit: the kick ducking the hats IS the
 *    sound. A compressor that only ever sees one isolated hit cannot do that.
 *
 * So only gain staging belongs in the offline build. Everything here is live.
 *
 * Signal flow:
 *
 *   voice -> partGain -> [EQ] -> [comp] -> partOut --+--> masterBus
 *                                                     |      |
 *                                            reverbSend      v
 *                                                     |   masterComp
 *                                                     v      |
 *                                              Convolver     v
 *                                                     |   limiter -> destination
 *                                                     +------^
 *
 * One shared convolver, never one per part: convolution is the only real CPU
 * cost in this graph and mobile can afford exactly one.
 */

export type EqBand = {
  /** Hz */
  freq: number
  /** dB */
  gain: number
  /** Only meaningful for the peaking band. */
  q?: number
}

/**
 * Amp/cabinet emulation.
 *
 * The parallel split is the point. Distorting a bass's fundamental makes it
 * flabby and eats the low end — real bass drive circuits high-pass before the
 * clipping stage so the sub stays clean and only the mids get the harmonics.
 * `driveHighPassHz` is that split, and `mix` blends the driven band back
 * against the untouched dry signal.
 */
export type DriveSettings = {
  /**
   * Neural amp capture to use instead of the waveshaper.
   *
   * STRONGLY PREFERRED for guitar. A WaveShaper is memoryless — its output
   * depends only on the current sample — so it cannot express the
   * signal-history-dependent behaviour that makes an amplifier sound like one,
   * no matter how the curve is shaped. These are LSTM captures of real amps.
   * `amount` below is retained as the fallback when the worklet or the model
   * is unavailable, and for bass, which is not modelled.
   */
  amp?: {
    /** Model name under /jam-player/amp/, e.g. "Soldano_highGain". */
    model: string
    /**
     * Level into the model — effectively the amp's gain knob, since the
     * network was trained at one specific input level.
     */
    inputGain?: number
    /** Make-up, so swapping models does not shift the mix balance. */
    outputGain?: number
  }
  /** Soft-clip amount. 0 = clean, 1 = heavily saturated. */
  amount: number
  /** Only frequencies above this are driven; below stays clean. */
  driveHighPassHz?: number
  /** Wet/dry blend of the driven band, 0-1. */
  mix?: number
  /**
   * Speaker emulation applied after the clipper.
   *
   * `ir` is strongly preferred: a real convolution of a measured/synthesised
   * cabinet response is what makes a waveshaper sound like an amp rather than
   * a fuzz box, and no filter pair approximates the 6 kHz cliff convincingly.
   * The lowPass/resonance fields remain as the fallback when no IR has been
   * loaded yet.
   */
  cabinet?: {
    /** Filename under /jam-player/ir/, e.g. "cab-4x12-rock.ogg". */
    ir?: string
    lowPassHz: number
    /** Cab resonance bump, typically 80-120 Hz on a bass cabinet. */
    resonanceHz?: number
    resonanceGain?: number
  }
}

/**
 * Feedback delay.
 *
 * Time is expressed in BEATS, not milliseconds, because in a practice tool the
 * tempo moves constantly — a fixed-ms delay would drift out of the groove the
 * moment the trainer steps the tempo up. `EffectsRack.setTempo()` recomputes
 * every delay line when the transport changes.
 *
 * `dampHz` low-passes the feedback path so each repeat is darker than the last,
 * which is how real delays behave; without it the repeats pile up and turn to
 * hash.
 */
export type DelaySettings = {
  /** Delay time in beats. 0.375 = dotted eighth, 0.5 = eighth, 0.75 = dotted. */
  beats: number
  /** 0-0.85. Above that it self-oscillates. */
  feedback: number
  /** Wet level, 0-1. */
  mix: number
  /** Low-pass on the feedback path, Hz. */
  dampHz?: number
}

export type PartEffectSettings = {
  lowShelf?: EqBand
  /** Single peaking band. Prefer `peaks` when more than one is needed. */
  peak?: EqBand
  /** Multiple peaking bands, applied in order. Bass needs at least two: a cut
   *  in the 200-400 Hz mud zone and a boost around 800 Hz for definition. */
  peaks?: EqBand[]
  highShelf?: EqBand
  drive?: DriveSettings
  delay?: DelaySettings
  /** High-pass to clear mud below the instrument's real range. */
  highPassHz?: number
  compressor?: {
    /** dB */
    threshold: number
    /** dB */
    knee: number
    ratio: number
    /** seconds */
    attack: number
    /** seconds */
    release: number
  }
  /** 0-1 send into the shared reverb. */
  reverbSend?: number
  /** Linear trim applied after EQ/comp, for bus balance. */
  trim?: number
}

export type StyleEffectPreset = {
  id: string
  label: string
  reverb: {
    /** Impulse response url, relative to /jam-player/ir/. */
    ir: string
    /** Wet return level, 0-1. */
    wet: number
    /** Roll off the send so reverb does not muddy the low end. */
    sendHighPassHz?: number
  }
  master: {
    threshold: number
    knee: number
    ratio: number
    attack: number
    release: number
    /** Output ceiling, linear. */
    gain: number
  }
  parts: Partial<Record<BandPart, PartEffectSettings>>
}

type DelayLine = { node: DelayNode; beats: number }

export type PartChain = {
  /** Connect voices here. */
  input: GainNode
  /** Set by the player for mute/volume; sits before the EQ. */
  gain: GainNode
  dispose(): void
}

const DEFAULT_MASTER = {
  threshold: -12,
  knee: 6,
  ratio: 2.5,
  attack: 0.006,
  release: 0.18,
  gain: 0.9,
}

/**
 * Asymmetric soft clip whose `amount` actually does something.
 *
 * THE BUG THIS REPLACES. The previous curve was `tanh(k·x) / tanh(k)` with
 * `k = 1 + amount·24` — peak-normalised. Peak normalisation always maps ±1 to
 * ±1, so once `k > 3` (i.e. `amount > 0.09`) `tanh(k) ≈ 1` and the shape stops
 * changing: amount 0.12 and amount 0.72 both compressed a half-scale signal by
 * ~6 dB. The knob was inert across its whole useful range. That is why every
 * style's guitar sounded equally distorted and why the rock amp could not be
 * made to sound like more than fizz.
 *
 * THE FIX is to normalise at a MID-LEVEL reference (x = 0.5) instead of at the
 * peak. A nominal-level signal then passes at unity for every amount, while
 * quiet signals get progressively more make-up gain and loud ones progressively
 * more squash — which is what a gain knob into a valve stage actually does.
 * Measured quiet-to-loud compression across the range:
 *
 *     amount 0.0 → 3.7 dB    0.22 → 8.1 dB    0.72 → 20.8 dB
 *
 * `DRIVE_BIAS` offsets the signal into the curve so the two halves of the
 * waveform saturate at different rates. A symmetric shaper produces only ODD
 * harmonics, which is the buzzy solid-state character; the asymmetry adds the
 * even harmonics that read as "warm". The DC it introduces is removed by the
 * high-pass that follows.
 */
const DRIVE_BIAS = 0.35

function makeSoftClipCurve(
  amount: number,
  samples = 8192,
): Float32Array<ArrayBuffer> {
  // 0 → unity (near-transparent), 1 → +30 dB into the clipper.
  const g = Math.pow(10, (Math.max(0, Math.min(1, amount)) * 30) / 20)
  const shift = Math.tanh(DRIVE_BIAS)
  const raw = (x: number) => Math.tanh(g * x + DRIVE_BIAS) - shift
  // Unity at half scale, so drive changes character without changing level.
  const norm = raw(0.5) / 0.5
  const curve = new Float32Array(new ArrayBuffer(samples * 4))
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1
    curve[i] = Math.max(-1, Math.min(1, raw(x) / norm))
  }
  return curve
}

export class EffectsRack {
  readonly masterBus: GainNode
  private masterComp: DynamicsCompressorNode
  private limiter: DynamicsCompressorNode
  private convolver: ConvolverNode
  private reverbReturn: GainNode
  private reverbSendBus: GainNode
  private sendHighPass: BiquadFilterNode
  private chains = new Map<
    BandPart,
    { nodes: AudioNode[]; send: GainNode; delays: DelayLine[] }
  >()
  private tempo = 100
  private irCache = new Map<string, AudioBuffer>()
  private preset: StyleEffectPreset | null = null
  private irBase = "/jam-player/ir"
  /** Parsed amp captures, keyed by model name. Populated by loadAmpModel. */
  private ampCache = new Map<string, AmpWeights>()
  /** addModule() is once-per-context; this memoises the promise. */
  private ampWorkletReady: Promise<boolean> | null = null

  constructor(
    private readonly ctx: BaseAudioContext,
    destination?: AudioNode,
  ) {
    this.masterBus = ctx.createGain()
    this.masterBus.gain.value = 1

    this.masterComp = ctx.createDynamicsCompressor()
    this.applyComp(this.masterComp, DEFAULT_MASTER)

    // A second compressor with a hard ratio acts as a catch-all limiter.
    // DynamicsCompressorNode is a fixed algorithm and mediocre for character
    // compression, but perfectly adequate as a ceiling.
    this.limiter = ctx.createDynamicsCompressor()
    this.applyComp(this.limiter, {
      threshold: -1.5,
      knee: 0,
      ratio: 20,
      attack: 0.001,
      release: 0.08,
    })

    this.convolver = ctx.createConvolver()
    this.convolver.normalize = true

    this.sendHighPass = ctx.createBiquadFilter()
    this.sendHighPass.type = "highpass"
    this.sendHighPass.frequency.value = 200

    this.reverbSendBus = ctx.createGain()
    this.reverbSendBus.gain.value = 1

    this.reverbReturn = ctx.createGain()
    this.reverbReturn.gain.value = 0.25

    // sends -> highpass -> convolver -> return -> master
    this.reverbSendBus.connect(this.sendHighPass)
    this.sendHighPass.connect(this.convolver)
    this.convolver.connect(this.reverbReturn)
    this.reverbReturn.connect(this.masterBus)

    this.masterBus.connect(this.masterComp)
    this.masterComp.connect(this.limiter)
    this.limiter.connect(destination ?? (ctx as AudioContext).destination)
  }

  private applyComp(
    node: DynamicsCompressorNode,
    s: { threshold: number; knee: number; ratio: number; attack: number; release: number },
  ) {
    node.threshold.value = s.threshold
    node.knee.value = s.knee
    node.ratio.value = s.ratio
    node.attack.value = s.attack
    node.release.value = s.release
  }

  /**
   * Build the per-part chain. Returns the node voices connect to, plus the
   * gain node the player owns for mute and volume — kept FIRST in the chain so
   * muting also silences that part's reverb send, which it must.
   */
  createPartChain(part: BandPart, settings: PartEffectSettings = {}): PartChain {
    this.disposePart(part)

    const input = this.ctx.createGain()
    const nodes: AudioNode[] = [input]
    let tail: AudioNode = input

    if (settings.highPassHz) {
      const hp = this.ctx.createBiquadFilter()
      hp.type = "highpass"
      hp.frequency.value = settings.highPassHz
      tail.connect(hp)
      nodes.push(hp)
      tail = hp
    }
    const eqBands: [BiquadFilterType, EqBand | undefined][] = [
      ["lowshelf", settings.lowShelf],
      ["peaking", settings.peak],
      ...(settings.peaks ?? []).map(
        (b) => ["peaking", b] as [BiquadFilterType, EqBand],
      ),
      ["highshelf", settings.highShelf],
    ]
    for (const [type, band] of eqBands) {
      if (!band) continue
      const f = this.ctx.createBiquadFilter()
      f.type = type
      f.frequency.value = band.freq
      f.gain.value = band.gain
      if (band.q !== undefined) f.Q.value = band.q
      tail.connect(f)
      nodes.push(f)
      tail = f
    }
    // `amp` counts even at amount 0: the neural model replaces the waveshaper
    // entirely, so a rig can be a pure amp capture with no soft-clip at all.
    if (settings.drive && (settings.drive.amount > 0 || settings.drive.amp)) {
      // Parallel drive: the low end bypasses the clipper entirely. Clipping a
      // bass fundamental makes it flabby and swallows the low end; real bass
      // drive circuits high-pass first so only the mids gain harmonics.
      const d = settings.drive
      const split = this.ctx.createGain()
      tail.connect(split)
      nodes.push(split)

      const dryPath = this.ctx.createGain()
      dryPath.gain.value = 1 - Math.min(1, d.mix ?? 0.5)
      split.connect(dryPath)
      nodes.push(dryPath)

      let wet: AudioNode = split
      if (d.driveHighPassHz) {
        const hp = this.ctx.createBiquadFilter()
        hp.type = "highpass"
        hp.frequency.value = d.driveHighPassHz
        wet.connect(hp)
        nodes.push(hp)
        wet = hp
      }

      const ampWeights = d.amp ? this.ampCache.get(d.amp.model) : undefined
      if (d.amp && ampWeights) {
        // Neural capture of a real amp. See lstm-amp.worklet.js.
        const amp = new AudioWorkletNode(this.ctx as AudioContext, "lstm-amp", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1], // an amp has one speaker output
        })
        const p = amp.parameters
        p.get("inputGain")!.value = d.amp.inputGain ?? 1
        p.get("outputGain")!.value = d.amp.outputGain ?? 1
        amp.port.postMessage(ampModelMessage(ampWeights))
        wet.connect(amp)
        nodes.push(amp)
        wet = amp
      } else {
        if (d.amp) {
          console.warn(
            `[effects] amp model "${d.amp.model}" not preloaded; ` +
              "falling back to the waveshaper",
          )
        }
        const shaper = this.ctx.createWaveShaper()
        shaper.curve = makeSoftClipCurve(d.amount)
        shaper.oversample = "4x" // controls aliasing from the nonlinearity
        wet.connect(shaper)
        nodes.push(shaper)
        wet = shaper
      }

      // Both paths emit DC — the clip curve is deliberately asymmetric, and a
      // neural model has no reason to be centred either. Left in, DC eats
      // headroom and pushes the cabinet convolution off-centre.
      const dcBlock = this.ctx.createBiquadFilter()
      dcBlock.type = "highpass"
      dcBlock.frequency.value = 20
      wet.connect(dcBlock)
      nodes.push(dcBlock)
      wet = dcBlock

      const cabBuffer = d.cabinet?.ir ? this.irCache.get(this.irUrl(d.cabinet.ir)) : undefined
      if (cabBuffer) {
        const conv = this.ctx.createConvolver()
        conv.normalize = false // the IR is already level-matched at build time
        conv.buffer = cabBuffer
        wet.connect(conv)
        nodes.push(conv)
        wet = conv
      } else if (d.cabinet) {
        const lp = this.ctx.createBiquadFilter()
        lp.type = "lowpass"
        lp.frequency.value = d.cabinet.lowPassHz
        lp.Q.value = 0.7
        wet.connect(lp)
        nodes.push(lp)
        wet = lp
        if (d.cabinet.resonanceHz) {
          const res = this.ctx.createBiquadFilter()
          res.type = "peaking"
          res.frequency.value = d.cabinet.resonanceHz
          res.gain.value = d.cabinet.resonanceGain ?? 3
          res.Q.value = 1.2
          wet.connect(res)
          nodes.push(res)
          wet = res
        }
      }

      const wetGain = this.ctx.createGain()
      wetGain.gain.value = Math.min(1, d.mix ?? 0.5)
      wet.connect(wetGain)
      nodes.push(wetGain)

      const merged = this.ctx.createGain()
      dryPath.connect(merged)
      wetGain.connect(merged)
      nodes.push(merged)
      tail = merged
    }

    const delays: DelayLine[] = []
    if (settings.delay && settings.delay.mix > 0) {
      const d = settings.delay
      const split = this.ctx.createGain()
      tail.connect(split)
      nodes.push(split)

      const node = this.ctx.createDelay(4) // 4s ceiling covers a whole bar at 60bpm
      node.delayTime.value = this.beatsToSeconds(d.beats)

      const fb = this.ctx.createGain()
      fb.gain.value = Math.max(0, Math.min(0.85, d.feedback))

      const damp = this.ctx.createBiquadFilter()
      damp.type = "lowpass"
      damp.frequency.value = d.dampHz ?? 3500

      // node -> damp -> fb -> node : each repeat darker than the last.
      split.connect(node)
      node.connect(damp)
      damp.connect(fb)
      fb.connect(node)

      const wet = this.ctx.createGain()
      wet.gain.value = Math.min(1, d.mix)
      node.connect(wet)

      const merged = this.ctx.createGain()
      split.connect(merged)
      wet.connect(merged)
      nodes.push(node, damp, fb, wet, merged)
      delays.push({ node, beats: d.beats })
      tail = merged
    }

    if (settings.compressor) {
      const c = this.ctx.createDynamicsCompressor()
      this.applyComp(c, settings.compressor)
      tail.connect(c)
      nodes.push(c)
      tail = c
    }

    const trim = this.ctx.createGain()
    trim.gain.value = settings.trim ?? 1
    tail.connect(trim)
    nodes.push(trim)

    trim.connect(this.masterBus)

    const send = this.ctx.createGain()
    send.gain.value = settings.reverbSend ?? 0
    trim.connect(send)
    send.connect(this.reverbSendBus)

    this.chains.set(part, { nodes, send, delays })
    return {
      input,
      gain: input,
      dispose: () => this.disposePart(part),
    }
  }

  private beatsToSeconds(beats: number): number {
    return Math.max(0.001, Math.min(4, (60 / this.tempo) * beats))
  }

  /**
   * Keep every delay line locked to the transport. Ramped rather than set
   * instantly: jumping delayTime resamples the buffer and produces an audible
   * pitch artefact, which is very noticeable when the tempo trainer steps up.
   */
  setTempo(bpm: number) {
    this.tempo = Math.max(20, Math.min(300, bpm))
    const now = this.ctx.currentTime
    for (const chain of this.chains.values()) {
      for (const d of chain.delays) {
        d.node.delayTime.linearRampToValueAtTime(
          this.beatsToSeconds(d.beats),
          now + 0.08,
        )
      }
    }
  }

  setReverbSend(part: BandPart, amount: number) {
    const c = this.chains.get(part)
    if (!c) return
    c.send.gain.setTargetAtTime(
      Math.max(0, Math.min(1, amount)),
      this.ctx.currentTime,
      0.02,
    )
  }

  setReverbWet(wet: number) {
    this.reverbReturn.gain.setTargetAtTime(
      Math.max(0, Math.min(1, wet)),
      this.ctx.currentTime,
      0.05,
    )
  }

  /** Bypass everything but gain staging, for A/B against the raw samples. */
  setBypass(bypassed: boolean) {
    this.reverbReturn.gain.setTargetAtTime(
      bypassed ? 0 : (this.preset?.reverb.wet ?? 0.25),
      this.ctx.currentTime,
      0.05,
    )
    // Neutralise the master compressor rather than rewiring the graph.
    this.masterComp.threshold.value = bypassed ? 0 : (this.preset?.master.threshold ?? DEFAULT_MASTER.threshold)
    this.masterComp.ratio.value = bypassed ? 1 : (this.preset?.master.ratio ?? DEFAULT_MASTER.ratio)
  }

  private irUrl(name: string): string {
    return name.startsWith("/") ? name : `${this.irBase}/${name}`
  }

  /** Preload a cabinet IR so createPartChain can use it synchronously. */
  async loadCabinet(name: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
    return this.loadImpulseInto(this.irUrl(name), fetchImpl)
  }

  /**
   * Preload a neural amp capture, mirroring loadCabinet: createPartChain is
   * synchronous, so both the worklet module and the weights have to be in
   * place before the chain is built or the part silently falls back.
   *
   * Returns false rather than throwing — a missing amp should cost the guitar
   * its character, not its audibility.
   *
   * A failed worklet `addModule` clears the memoised promise so a later call
   * can retry (transient network / first-paint races used to lock the
   * AudioContext into waveshaper fallback for the whole session).
   */
  async loadAmpModel(name: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
    if (this.ampCache.has(name)) return true

    const ctx = this.ctx as unknown as { audioWorklet?: AudioWorklet }
    if (!ctx.audioWorklet) return false

    if (!this.ampWorkletReady) {
      this.ampWorkletReady = ctx.audioWorklet
        .addModule("/jam-player/amp/lstm-amp.worklet.js")
        .then(() => true)
        .catch((err) => {
          console.warn("[effects] amp worklet failed to load", err)
          this.ampWorkletReady = null
          return false
        })
    }

    const [ready, weights] = await Promise.all([
      this.ampWorkletReady,
      fetchAmpModel(name, fetchImpl).catch((err) => {
        console.warn(`[effects] amp model ${name} failed to load`, err)
        return null
      }),
    ])
    if (!ready || !weights) return false

    this.ampCache.set(name, weights)
    return true
  }

  /** True when createPartChain can build a neural amp for this model. */
  hasAmpModel(name: string | undefined): boolean {
    return !!name && this.ampCache.has(name)
  }

  /** Fetch + decode + cache only. Does NOT touch the reverb convolver. */
  private async loadImpulseInto(
    url: string,
    fetchImpl: typeof fetch = fetch,
  ): Promise<boolean> {
    if (this.irCache.has(url)) return true
    try {
      const res = await fetchImpl(url)
      if (!res.ok) throw new Error(String(res.status))
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer())
      this.irCache.set(url, buf)
      return true
    } catch {
      return false
    }
  }

  async loadImpulse(url: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
    const cached = this.irCache.get(url)
    if (cached) {
      this.convolver.buffer = cached
      return true
    }
    try {
      const res = await fetchImpl(url)
      if (!res.ok) throw new Error(String(res.status))
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer())
      this.irCache.set(url, buf)
      this.convolver.buffer = buf
      return true
    } catch {
      // No reverb is far better than no audio. Leave the convolver empty; the
      // dry path is untouched.
      return false
    }
  }

  async applyPreset(
    preset: StyleEffectPreset,
    opts: { irBase?: string; fetchImpl?: typeof fetch } = {},
  ): Promise<void> {
    this.preset = preset
    this.applyComp(this.masterComp, preset.master)
    this.masterBus.gain.value = preset.master.gain
    this.sendHighPass.frequency.value = preset.reverb.sendHighPassHz ?? 200
    this.setReverbWet(preset.reverb.wet)
    const base = opts.irBase ?? "/jam-player/ir"
    await this.loadImpulse(`${base}/${preset.reverb.ir}`, opts.fetchImpl)
  }

  getPreset(): StyleEffectPreset | null {
    return this.preset
  }

  private disposePart(part: BandPart) {
    const c = this.chains.get(part)
    if (!c) return
    for (const n of c.nodes) {
      try {
        n.disconnect()
      } catch {
        /* ignore */
      }
    }
    try {
      c.send.disconnect()
    } catch {
      /* ignore */
    }
    this.chains.delete(part)
  }

  dispose() {
    for (const part of [...this.chains.keys()]) this.disposePart(part)
    for (const n of [
      this.masterBus,
      this.masterComp,
      this.limiter,
      this.convolver,
      this.reverbReturn,
      this.reverbSendBus,
      this.sendHighPass,
    ]) {
      try {
        n.disconnect()
      } catch {
        /* ignore */
      }
    }
  }
}
