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
 *   voice -> partGain -> [EQ] -> [comp] -> [pan] -> partOut --+--> masterBus
 *                                                              |      |
 *                                                     reverbSend      v
 *                                                              |   master EQ
 *                                                              v      |
 *                                                       Convolver     v
 *                                                              |  glue comp
 *                                                              +------v
 *                                                                  limiter
 *                                                                     |
 *                                                               output trim
 *                                                                     |
 *                                                               destination
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

/** User mixer EQ offsets in dB. Zero leaves the curated style tone intact. */
export type UserEqSettings = {
  low: number
  mid: number
  high: number
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
  /**
   * An additional compressed lane beneath the direct signal. This mirrors the
   * DI + Comp workflow used by dedicated bass instruments: the pluck remains
   * intact on the dry path while the parallel lane supplies stable body.
   */
  parallelCompressor?: {
    threshold: number
    knee: number
    ratio: number
    attack: number
    release: number
    mix: number
    highPassHz?: number
    lowPassHz?: number
  }
  /**
   * Accent-only snare insert. The player routes GM snare note 38 here only
   * when its velocity reaches `minVelocity`; ghost notes stay on the untouched
   * drum path. This gives the backbeat compressed body and make-up gain
   * without making every quiet grace note jump forward.
   */
  snarePunch?: {
    /** GM notes routed through this insert. Defaults to the main snare (38). */
    notes?: number[]
    minVelocity: number
    highPassHz?: number
    /** Keep only the body of the compressed layer; the dry path supplies snap. */
    lowPassHz?: number
    peak?: EqBand
    compressor: {
      threshold: number
      knee: number
      ratio: number
      attack: number
      release: number
    }
    /** Linear make-up gain after compression. */
    trim: number
    /**
     * Adds the compressed signal underneath an untouched dry snare, like the
     * separate Comp channel in Toontrack. Undefined retains serial behavior.
     */
    parallelMix?: number
  }
  /** 0-1 send into the shared reverb. */
  reverbSend?: number
  /** Linear trim applied after EQ/comp, for bus balance. */
  trim?: number
  /**
   * Stereo position, -1 (left) to +1 (right). Keep bass and drums centred;
   * modest offsets on harmonic parts create separation without making the
   * arrangement collapse when it is played in mono.
   */
  pan?: number
}

export type StyleEffectPreset = {
  id: string
  label: string
  reverb: {
    /** Impulse response url, relative to /jam-player/ir/. */
    ir: string
    /** Musical shape used by the real-time Dattorro reverb. */
    character?: "tight-room" | "large-room" | "plate"
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
    /** Final output trim, linear. Applied after the safety limiter. */
    gain: number
    /** Removes inaudible sub energy before it steals compressor headroom. */
    highPassHz?: number
    /** Broad mastering tone controls. Keep these deliberately subtle. */
    lowShelf?: EqBand
    /** Broad low-mid cleanup after the parts have summed. */
    peak?: EqBand
    highShelf?: EqBand
    /** Limiter threshold in dBFS. Defaults to -1 dBFS. */
    limiterThreshold?: number
  }
  parts: Partial<Record<BandPart, PartEffectSettings>>
}

/**
 * Keep the curated low send values almost linear, but give the upper half of
 * the mixer control enough range to be unmistakable. With a restrained style
 * return (Funk is 0.10), a conventional 0-1 send made even 100% sound weak.
 * This reaches +6 dB at full send without changing the stored 0-100% value.
 */
export function reverbSendGainFromControl(amount: number): number {
  const clamped = Math.max(0, Math.min(1, amount))
  return clamped + clamped * clamped
}

type DattorroCharacter = NonNullable<StyleEffectPreset["reverb"]["character"]>

type DattorroSettings = {
  preDelayMs: number
  bandwidth: number
  inputDiffusion1: number
  inputDiffusion2: number
  decay: number
  decayDiffusion1: number
  decayDiffusion2: number
  damping: number
  excursionRate: number
  excursionDepth: number
}

/**
 * Three deliberately musical spaces rather than a wall of technical knobs.
 * The plate is wide and gently modulated; the rooms trade tail length for
 * definition. The existing per-style return and per-part sends still control
 * how much of the space reaches the mix.
 */
const DATTORRO_CHARACTERS: Record<DattorroCharacter, DattorroSettings> = {
  "tight-room": {
    preDelayMs: 12,
    bandwidth: 0.72,
    inputDiffusion1: 0.58,
    inputDiffusion2: 0.62,
    decay: 0.3,
    decayDiffusion1: 0.7,
    decayDiffusion2: 0.58,
    damping: 0.58,
    excursionRate: 0.12,
    excursionDepth: 0.18,
  },
  "large-room": {
    preDelayMs: 20,
    bandwidth: 0.9,
    inputDiffusion1: 0.72,
    inputDiffusion2: 0.64,
    decay: 0.58,
    decayDiffusion1: 0.74,
    decayDiffusion2: 0.52,
    damping: 0.36,
    excursionRate: 0.32,
    excursionDepth: 0.48,
  },
  plate: {
    preDelayMs: 26,
    bandwidth: 0.98,
    inputDiffusion1: 0.8,
    inputDiffusion2: 0.68,
    decay: 0.72,
    decayDiffusion1: 0.78,
    decayDiffusion2: 0.5,
    damping: 0.24,
    excursionRate: 0.48,
    excursionDepth: 0.72,
  },
}

const dattorroWorkletReady = new WeakMap<BaseAudioContext, Promise<boolean>>()

type DelayLine = { node: DelayNode; beats: number }

export type PartChain = {
  /** Connect voices here. */
  input: GainNode
  /** Selects a dedicated insert for note/velocity combinations that need it. */
  inputForNote(note: number, velocity: number): AudioNode
  /** Set by the player for mute/volume; sits before the main part EQ. */
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
  highPassHz: 25,
  lowShelf: { freq: 90, gain: -0.5 },
  peak: { freq: 280, gain: -0.75, q: 0.75 },
  highShelf: { freq: 9000, gain: 0.5 },
  limiterThreshold: -1,
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
  private masterHighPass: BiquadFilterNode
  private masterLowShelf: BiquadFilterNode
  private masterPeak: BiquadFilterNode
  private masterHighShelf: BiquadFilterNode
  private masterComp: DynamicsCompressorNode
  private limiter: DynamicsCompressorNode
  private masterOutput: GainNode
  private convolver: ConvolverNode
  private dattorro: AudioWorkletNode | null = null
  private activeReverb: AudioNode
  private reverbReturn: GainNode
  private reverbSendBus: GainNode
  private sendHighPass: BiquadFilterNode
  private chains = new Map<
    string,
    {
      part: BandPart
      nodes: AudioNode[]
      send: GainNode
      delays: DelayLine[]
      userEq: {
        low: BiquadFilterNode
        mid: BiquadFilterNode
        high: BiquadFilterNode
      }
      pan: StereoPannerNode | null
      panOffset: number
      panScale: number
    }
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

    this.masterHighPass = ctx.createBiquadFilter()
    this.masterHighPass.type = "highpass"
    this.masterHighPass.frequency.value = DEFAULT_MASTER.highPassHz
    this.masterHighPass.Q.value = 0.7

    this.masterLowShelf = ctx.createBiquadFilter()
    this.masterLowShelf.type = "lowshelf"
    this.masterLowShelf.frequency.value = DEFAULT_MASTER.lowShelf.freq
    this.masterLowShelf.gain.value = DEFAULT_MASTER.lowShelf.gain

    this.masterPeak = ctx.createBiquadFilter()
    this.masterPeak.type = "peaking"
    this.masterPeak.frequency.value = DEFAULT_MASTER.peak.freq
    this.masterPeak.gain.value = DEFAULT_MASTER.peak.gain
    this.masterPeak.Q.value = DEFAULT_MASTER.peak.q

    this.masterHighShelf = ctx.createBiquadFilter()
    this.masterHighShelf.type = "highshelf"
    this.masterHighShelf.frequency.value = DEFAULT_MASTER.highShelf.freq
    this.masterHighShelf.gain.value = DEFAULT_MASTER.highShelf.gain

    this.masterComp = ctx.createDynamicsCompressor()
    this.applyComp(this.masterComp, DEFAULT_MASTER)

    // A second compressor with a hard ratio acts as a safety limiter. Web
    // Audio's compressor has built-in lookahead, which is useful here, but it
    // is not a true-peak brickwall limiter; the post-limiter output trim keeps
    // an additional margin for inter-sample peaks and lossy encoding.
    this.limiter = ctx.createDynamicsCompressor()
    this.applyComp(this.limiter, {
      threshold: DEFAULT_MASTER.limiterThreshold,
      knee: 0,
      ratio: 20,
      attack: 0.001,
      release: 0.08,
    })

    this.masterOutput = ctx.createGain()
    this.masterOutput.gain.value = DEFAULT_MASTER.gain

    this.convolver = ctx.createConvolver()
    this.convolver.normalize = true
    this.activeReverb = this.convolver

    this.sendHighPass = ctx.createBiquadFilter()
    this.sendHighPass.type = "highpass"
    this.sendHighPass.frequency.value = 200

    this.reverbSendBus = ctx.createGain()
    this.reverbSendBus.gain.value = 1

    this.reverbReturn = ctx.createGain()
    this.reverbReturn.gain.value = 0.25

    // The convolver is the boot/fallback path. applyPreset upgrades this to a
    // real-time Dattorro space when AudioWorklet is available.
    this.reverbSendBus.connect(this.sendHighPass)
    this.sendHighPass.connect(this.convolver)
    this.convolver.connect(this.reverbReturn)
    this.reverbReturn.connect(this.masterBus)

    this.masterBus.connect(this.masterHighPass)
    this.masterHighPass.connect(this.masterLowShelf)
    this.masterLowShelf.connect(this.masterPeak)
    this.masterPeak.connect(this.masterHighShelf)
    this.masterHighShelf.connect(this.masterComp)
    this.masterComp.connect(this.limiter)
    this.limiter.connect(this.masterOutput)
    this.masterOutput.connect(destination ?? (ctx as AudioContext).destination)
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
  createPartChain(
    part: BandPart,
    settings: PartEffectSettings = {},
    options: { layerId?: string; panOffset?: number } = {},
  ): PartChain {
    const chainKey = options.layerId ? `${part}::${options.layerId}` : part
    if (options.layerId) this.disposeChain(chainKey)
    else this.disposePart(part)

    const input = this.ctx.createGain()
    const gain = this.ctx.createGain()
    input.connect(gain)
    const nodes: AudioNode[] = [input, gain]
    let inputForNote = (_note: number, _velocity: number): AudioNode => input

    if (part === "drums" && settings.snarePunch) {
      const punch = settings.snarePunch
      const snareInput = this.ctx.createGain()
      let snareTail: AudioNode = snareInput
      nodes.push(snareInput)

      if (punch.highPassHz) {
        const hp = this.ctx.createBiquadFilter()
        hp.type = "highpass"
        hp.frequency.value = punch.highPassHz
        snareTail.connect(hp)
        nodes.push(hp)
        snareTail = hp
      }
      if (punch.peak) {
        const presence = this.ctx.createBiquadFilter()
        presence.type = "peaking"
        presence.frequency.value = punch.peak.freq
        presence.gain.value = punch.peak.gain
        presence.Q.value = punch.peak.q ?? 1
        snareTail.connect(presence)
        nodes.push(presence)
        snareTail = presence
      }
      if (punch.lowPassHz) {
        const lp = this.ctx.createBiquadFilter()
        lp.type = "lowpass"
        lp.frequency.value = punch.lowPassHz
        lp.Q.value = 0.7
        snareTail.connect(lp)
        nodes.push(lp)
        snareTail = lp
      }

      const comp = this.ctx.createDynamicsCompressor()
      this.applyComp(comp, punch.compressor)
      snareTail.connect(comp)
      nodes.push(comp)

      const makeup = this.ctx.createGain()
      const parallelMix = punch.parallelMix === undefined
        ? undefined
        : Math.max(0, Math.min(1, punch.parallelMix))
      makeup.gain.value = punch.trim * (parallelMix ?? 1)
      comp.connect(makeup)
      makeup.connect(gain)
      nodes.push(makeup)

      if (parallelMix !== undefined) {
        // The direct close-mic path retains the initial crack. The darker,
        // compressed duplicate contributes shell/body underneath it.
        const drySnare = this.ctx.createGain()
        drySnare.gain.value = 1
        snareInput.connect(drySnare)
        drySnare.connect(gain)
        nodes.push(drySnare)
      }

      const punchNotes = new Set(punch.notes ?? [38])
      inputForNote = (note, velocity) =>
        punchNotes.has(note) && velocity >= punch.minVelocity ? snareInput : input
    }

    let tail: AudioNode = gain

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

    if (settings.parallelCompressor && settings.parallelCompressor.mix > 0) {
      const p = settings.parallelCompressor
      const split = this.ctx.createGain()
      tail.connect(split)
      nodes.push(split)

      const dry = this.ctx.createGain()
      dry.gain.value = 1
      split.connect(dry)
      nodes.push(dry)

      let compressed: AudioNode = split
      if (p.highPassHz) {
        const hp = this.ctx.createBiquadFilter()
        hp.type = "highpass"
        hp.frequency.value = p.highPassHz
        compressed.connect(hp)
        nodes.push(hp)
        compressed = hp
      }
      if (p.lowPassHz) {
        const lp = this.ctx.createBiquadFilter()
        lp.type = "lowpass"
        lp.frequency.value = p.lowPassHz
        lp.Q.value = 0.7
        compressed.connect(lp)
        nodes.push(lp)
        compressed = lp
      }

      const comp = this.ctx.createDynamicsCompressor()
      this.applyComp(comp, p)
      compressed.connect(comp)
      nodes.push(comp)

      const wet = this.ctx.createGain()
      wet.gain.value = Math.max(0, Math.min(1, p.mix))
      comp.connect(wet)
      nodes.push(wet)

      const merged = this.ctx.createGain()
      dry.connect(merged)
      wet.connect(merged)
      nodes.push(merged)
      tail = merged
    }

    if (settings.compressor) {
      const c = this.ctx.createDynamicsCompressor()
      this.applyComp(c, settings.compressor)
      tail.connect(c)
      nodes.push(c)
      tail = c
    }

    // Fixed post-insert mixer EQ. These start flat and sit after the amp and
    // compressor, so user adjustments are offsets from the curated style tone
    // rather than replacements for it. Keeping the nodes alive lets the mixer
    // move them smoothly during playback without rebuilding the channel.
    const userLow = this.ctx.createBiquadFilter()
    userLow.type = "lowshelf"
    userLow.frequency.value = 140
    userLow.gain.value = 0
    tail.connect(userLow)
    nodes.push(userLow)

    const userMid = this.ctx.createBiquadFilter()
    userMid.type = "peaking"
    userMid.frequency.value = 1100
    userMid.Q.value = 0.8
    userMid.gain.value = 0
    userLow.connect(userMid)
    nodes.push(userMid)

    const userHigh = this.ctx.createBiquadFilter()
    userHigh.type = "highshelf"
    userHigh.frequency.value = 6200
    userHigh.gain.value = 0
    userMid.connect(userHigh)
    nodes.push(userHigh)
    tail = userHigh

    let userPan: StereoPannerNode | null = null
    if ("createStereoPanner" in this.ctx) {
      const panner = this.ctx.createStereoPanner()
      panner.pan.value = Math.max(
        -1,
        Math.min(1, options.panOffset ?? settings.pan ?? 0),
      )
      tail.connect(panner)
      nodes.push(panner)
      tail = panner
      userPan = panner
    }

    const trim = this.ctx.createGain()
    trim.gain.value = settings.trim ?? 1
    tail.connect(trim)
    nodes.push(trim)

    trim.connect(this.masterBus)

    const send = this.ctx.createGain()
    send.gain.value = reverbSendGainFromControl(settings.reverbSend ?? 0)
    trim.connect(send)
    send.connect(this.reverbSendBus)

    this.chains.set(chainKey, {
      part,
      nodes,
      send,
      delays,
      userEq: { low: userLow, mid: userMid, high: userHigh },
      pan: userPan,
      panOffset: options.panOffset ?? 0,
      // The shared mixer pan can nudge a doubled pair without collapsing its
      // hard-left/hard-right image. Ordinary one-chain parts retain full pan.
      panScale: options.layerId ? 0.2 : 1,
    })
    return {
      input,
      inputForNote,
      gain,
      dispose: () => options.layerId
        ? this.disposeChain(chainKey)
        : this.disposePart(part),
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
    for (const c of this.chains.values()) {
      if (c.part !== part) continue
      c.send.gain.setTargetAtTime(
        reverbSendGainFromControl(amount),
        this.ctx.currentTime,
        0.02,
      )
    }
  }

  setPartUserEq(part: BandPart, eq: UserEqSettings) {
    const now = this.ctx.currentTime
    const clampDb = (value: number) => Math.max(-12, Math.min(12, value))
    for (const c of this.chains.values()) {
      if (c.part !== part) continue
      c.userEq.low.gain.setTargetAtTime(clampDb(eq.low), now, 0.02)
      c.userEq.mid.gain.setTargetAtTime(clampDb(eq.mid), now, 0.02)
      c.userEq.high.gain.setTargetAtTime(clampDb(eq.high), now, 0.02)
    }
  }

  setPartPan(part: BandPart, pan: number) {
    for (const c of this.chains.values()) {
      if (c.part !== part) continue
      c.pan?.pan.setTargetAtTime(
        Math.max(-1, Math.min(1, c.panOffset + pan * c.panScale)),
        this.ctx.currentTime,
        0.02,
      )
    }
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

  private routeReverb(node: AudioNode) {
    if (node === this.activeReverb) return
    try {
      this.sendHighPass.disconnect()
    } catch {
      /* already disconnected */
    }
    try {
      this.activeReverb.disconnect()
    } catch {
      /* already disconnected */
    }
    this.sendHighPass.connect(node)
    node.connect(this.reverbReturn)
    this.activeReverb = node
  }

  private setDattorroParam(name: string, value: number) {
    const parameter = this.dattorro?.parameters.get(name)
    if (parameter) parameter.setValueAtTime(value, this.ctx.currentTime)
  }

  private configureDattorro(character: DattorroCharacter) {
    if (!this.dattorro) return
    const settings = DATTORRO_CHARACTERS[character]
    this.setDattorroParam(
      "preDelay",
      Math.min(this.ctx.sampleRate - 1, (settings.preDelayMs / 1000) * this.ctx.sampleRate),
    )
    this.setDattorroParam("bandwidth", settings.bandwidth)
    this.setDattorroParam("inputDiffusion1", settings.inputDiffusion1)
    this.setDattorroParam("inputDiffusion2", settings.inputDiffusion2)
    this.setDattorroParam("decay", settings.decay)
    this.setDattorroParam("decayDiffusion1", settings.decayDiffusion1)
    this.setDattorroParam("decayDiffusion2", settings.decayDiffusion2)
    this.setDattorroParam("damping", settings.damping)
    this.setDattorroParam("excursionRate", settings.excursionRate)
    this.setDattorroParam("excursionDepth", settings.excursionDepth)
    this.setDattorroParam("wet", 1)
    this.setDattorroParam("dry", 0)
  }

  /**
   * Prefer a modulated algorithmic tail, but never make it a playback
   * dependency: old browsers and failed worklets keep the convolution path.
   */
  private async useDattorro(character: DattorroCharacter): Promise<boolean> {
    const context = this.ctx as BaseAudioContext & { audioWorklet?: AudioWorklet }
    if (!context.audioWorklet || typeof AudioWorkletNode === "undefined") return false

    let ready = dattorroWorkletReady.get(this.ctx)
    if (!ready) {
      ready = context.audioWorklet
        .addModule("/jam-player/worklets/dattorro-reverb.worklet.js")
        .then(() => true)
        .catch((error) => {
          console.warn("[effects] Dattorro reverb failed to load", error)
          dattorroWorkletReady.delete(this.ctx)
          return false
        })
      dattorroWorkletReady.set(this.ctx, ready)
    }
    if (!(await ready)) return false

    if (!this.dattorro) {
      try {
        this.dattorro = new AudioWorkletNode(
          this.ctx as AudioContext,
          "smartbridge-dattorro-reverb",
          {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2],
          },
        )
        this.dattorro.onprocessorerror = () => {
          console.warn("[effects] Dattorro reverb stopped; returning to convolution")
          this.routeReverb(this.convolver)
          const preset = this.preset
          if (preset) void this.loadImpulse(this.irUrl(preset.reverb.ir))
        }
      } catch (error) {
        console.warn("[effects] Dattorro reverb could not be created", error)
        this.dattorro = null
        return false
      }
    }

    this.configureDattorro(character)
    this.routeReverb(this.dattorro)
    return true
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
    this.masterBus.gain.value = 1
    this.masterHighPass.frequency.value =
      preset.master.highPassHz ?? DEFAULT_MASTER.highPassHz
    this.applyMasterEq(
      this.masterLowShelf,
      preset.master.lowShelf ?? DEFAULT_MASTER.lowShelf,
    )
    this.applyMasterEq(
      this.masterPeak,
      preset.master.peak ?? DEFAULT_MASTER.peak,
    )
    this.applyMasterEq(
      this.masterHighShelf,
      preset.master.highShelf ?? DEFAULT_MASTER.highShelf,
    )
    this.limiter.threshold.value =
      preset.master.limiterThreshold ?? DEFAULT_MASTER.limiterThreshold
    this.masterOutput.gain.value = preset.master.gain
    this.sendHighPass.frequency.value = preset.reverb.sendHighPassHz ?? 200
    this.setReverbWet(preset.reverb.wet)
    const base = opts.irBase ?? "/jam-player/ir"
    this.irBase = base
    const usingDattorro = await this.useDattorro(
      preset.reverb.character ?? "tight-room",
    )
    if (!usingDattorro) {
      this.routeReverb(this.convolver)
      await this.loadImpulse(`${base}/${preset.reverb.ir}`, opts.fetchImpl)
    }
  }

  getPreset(): StyleEffectPreset | null {
    return this.preset
  }

  private applyMasterEq(node: BiquadFilterNode, band: EqBand) {
    node.frequency.value = band.freq
    node.gain.value = band.gain
    if (band.q !== undefined) node.Q.value = band.q
  }

  private disposeChain(chainKey: string) {
    const c = this.chains.get(chainKey)
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
    this.chains.delete(chainKey)
  }

  private disposePart(part: BandPart) {
    for (const [chainKey, chain] of [...this.chains.entries()]) {
      if (chain.part === part) this.disposeChain(chainKey)
    }
  }

  dispose() {
    for (const chainKey of [...this.chains.keys()]) this.disposeChain(chainKey)
    for (const n of new Set<AudioNode>([
      this.masterBus,
      this.masterHighPass,
      this.masterLowShelf,
      this.masterPeak,
      this.masterHighShelf,
      this.masterComp,
      this.limiter,
      this.masterOutput,
      this.convolver,
      ...(this.dattorro ? [this.dattorro] : []),
      this.reverbReturn,
      this.reverbSendBus,
      this.sendHighPass,
    ])) {
      try {
        n.disconnect()
      } catch {
        /* ignore */
      }
    }
  }
}
