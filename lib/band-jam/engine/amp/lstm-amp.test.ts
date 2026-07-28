/**
 * Proves the neural amp actually computes the amp.
 *
 * The realistic failure mode here is not a crash — it is a working-looking
 * processor that produces *some* distorted sound while getting the gate order,
 * the weight layout or the state handling subtly wrong. That sounds bad but
 * plausible, and by ear it is indistinguishable from "the amp sim is bad",
 * which is the exact trap this feature already fell into once with a
 * hand-tuned waveshaper.
 *
 * So the worklet's output is asserted sample-for-sample against an independent
 * NumPy implementation of PyTorch's documented LSTM equations
 * (scripts scratchpad: lstm_reference.py), run on the real published weights.
 *
 * Gate order (i, f, c, o at offsets 0, h, 2h, 3h) is taken from RTNeural's
 * lstm.tpp, which is what GuitarML's own plugins use to load these files. An
 * attempt to establish it empirically is documented as a negative result in
 * the reference script: every one of the 24 permutations yields a stable
 * periodic output, so no listening-style metric can tell them apart.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  AmpModelError,
  ampModelMessage,
  parseAmpModel,
  type AmpWeights,
} from "@/lib/band-jam/engine/amp/amp-models"

const WORKLET = path.join(
  process.cwd(),
  "public/jam-player/amp/lstm-amp.worklet.js",
)
const MODEL_DIR = path.join(process.cwd(), "public/jam-player/amp")
const FIXTURES = path.join(process.cwd(), "lib/band-jam/engine/amp/__fixtures__")

const RENDER_QUANTUM = 128

type Processor = {
  port: { onmessage: ((e: { data: unknown }) => void) | null }
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    params: Record<string, Float32Array>,
  ): boolean
}

/**
 * Load the worklet in Node. It is a plain script that expects the AudioWorklet
 * globals, so they are supplied rather than mocked away — the real class body
 * runs, which is the point.
 */
function loadProcessor(): new () => Processor {
  const code = readFileSync(WORKLET, "utf8")
  let Registered: (new () => Processor) | null = null
  class AudioWorkletProcessorStub {
    port = { onmessage: null, postMessage() {} }
  }
  const fn = new Function(
    "AudioWorkletProcessor",
    "registerProcessor",
    `${code}\nreturn null`,
  )
  fn(AudioWorkletProcessorStub, (_name: string, ctor: new () => Processor) => {
    Registered = ctor
  })
  if (!Registered) throw new Error("worklet did not registerProcessor")
  return Registered
}

function loadModel(name: string): AmpWeights {
  const raw = JSON.parse(
    readFileSync(path.join(MODEL_DIR, `${name}.json`), "utf8"),
  )
  return parseAmpModel(raw, name)
}

/** Run a signal through the processor in 128-frame blocks, as the browser does. */
function render(weights: AmpWeights, input: number[]): Float32Array {
  const Ctor = loadProcessor()
  const p = new Ctor()
  p.port.onmessage?.({ data: ampModelMessage(weights) })

  const out = new Float32Array(input.length)
  const params = {
    inputGain: new Float32Array([1]),
    outputGain: new Float32Array([1]),
  }
  for (let off = 0; off < input.length; off += RENDER_QUANTUM) {
    const n = Math.min(RENDER_QUANTUM, input.length - off)
    const inBuf = new Float32Array(RENDER_QUANTUM)
    inBuf.set(input.slice(off, off + n))
    const outBuf = new Float32Array(RENDER_QUANTUM)
    p.process([[inBuf]], [[outBuf]], params)
    out.set(outBuf.subarray(0, n), off)
  }
  return out
}

const MODELS = [
  "FenderPrinceton_clean",
  "MesaBoogieMk2b_Crunch",
  "Soldano_highGain",
] as const

describe("LSTM amp worklet", () => {
  it.each(MODELS)("matches the NumPy reference for %s", (name) => {
    const ref = JSON.parse(
      readFileSync(path.join(FIXTURES, `ref_${name}.json`), "utf8"),
    ) as { input: number[]; expected: number[] }

    const got = render(loadModel(name), ref.input)

    expect(got.length).toBe(ref.expected.length)
    let worst = 0
    for (let i = 0; i < ref.expected.length; i++) {
      worst = Math.max(worst, Math.abs(got[i] - ref.expected[i]))
    }
    // Float32 accumulation in the worklet vs float64 in NumPy. Anything above
    // this is a real disagreement, not rounding.
    expect(worst).toBeLessThan(1e-4)
  })

  it("carries state across render quanta", () => {
    // If state were reset per block, the output would be identical in each
    // 128-frame window for a periodic input whose period divides the quantum.
    const w = loadModel("Soldano_highGain")
    const input = Array.from({ length: 512 }, (_, i) =>
      0.4 * Math.sin((2 * Math.PI * i) / 32),
    )
    const out = render(w, input)
    const first = out.subarray(0, RENDER_QUANTUM)
    const last = out.subarray(384, 512)
    let diff = 0
    for (let i = 0; i < RENDER_QUANTUM; i++) diff += Math.abs(first[i] - last[i])
    // The tail has warmed up; the first block starts from zero state.
    expect(diff).toBeGreaterThan(1e-3)
  })

  it("passes audio through untouched before a model is loaded", () => {
    const Ctor = loadProcessor()
    const p = new Ctor()
    const inBuf = new Float32Array(RENDER_QUANTUM).fill(0.25)
    const outBuf = new Float32Array(RENDER_QUANTUM)
    p.process([[inBuf]], [[outBuf]], {
      inputGain: new Float32Array([1]),
      outputGain: new Float32Array([1]),
    })
    // A silent guitar is a worse failure than an unprocessed one.
    expect(Array.from(outBuf)).toEqual(Array.from(inBuf))
  })

  it("parses and runs MesaBoogieMk2b_Clean (production chime/clean rig)", () => {
    // No NumPy fixture yet for this model — still assert it loads and is not
    // a silent no-op, which is the failure mode that leaves pop/rnb without
    // their clean amp.
    const w = loadModel("MesaBoogieMk2b_Clean")
    expect(w.hidden).toBe(20)
    const input = Array.from({ length: 256 }, (_, i) =>
      0.3 * Math.sin((2 * Math.PI * i) / 40),
    )
    const out = render(w, input)
    const energy = out.reduce((s, v) => s + v * v, 0)
    expect(energy).toBeGreaterThan(1e-6)
  })

  it("gains up in the order the amps are named", () => {
    // Same input through clean -> crunch -> high gain must get progressively
    // hotter. This is the check that would catch a model file being swapped
    // or mislabelled in public/jam-player/amp.
    const input = Array.from({ length: 512 }, (_, i) =>
      0.35 * Math.sin((2 * Math.PI * 220 * i) / 44100),
    )
    const rms = (a: Float32Array) =>
      Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length)
    const levels = MODELS.map((m) => rms(render(loadModel(m), input)))
    expect(levels[0]).toBeLessThan(levels[1])
    expect(levels[1]).toBeLessThan(levels[2])
  })
})

describe("amp model parsing", () => {
  it("folds the two bias vectors and flattens the recurrent matrix", () => {
    const w = loadModel("Soldano_highGain")
    expect(w.hidden).toBe(20)
    expect(w.skip).toBe(true)
    expect(w.wIh.length).toBe(80)
    expect(w.wHh.length).toBe(80 * 20)
    expect(w.bias.length).toBe(80)
    expect(w.linW.length).toBe(20)
  })

  it("refuses a model it cannot actually run", () => {
    const raw = JSON.parse(
      readFileSync(path.join(MODEL_DIR, "Soldano_highGain.json"), "utf8"),
    )
    // A 2-layer model would otherwise load and silently use only layer 0.
    const twoLayer = {
      ...raw,
      model_data: { ...raw.model_data, num_layers: 2 },
    }
    expect(() => parseAmpModel(twoLayer, "two-layer")).toThrow(AmpModelError)

    const wrongHidden = {
      ...raw,
      model_data: { ...raw.model_data, hidden_size: 32 },
    }
    expect(() => parseAmpModel(wrongHidden, "wrong-hidden")).toThrow(
      AmpModelError,
    )
  })
})
