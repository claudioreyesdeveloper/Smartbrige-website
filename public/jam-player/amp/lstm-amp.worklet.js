/**
 * Neural guitar amp — LSTM inference in an AudioWorklet.
 *
 * WHY A NEURAL MODEL AND NOT A WAVESHAPER
 * ---------------------------------------
 * A `WaveShaper` is memoryless: its output depends only on the current sample.
 * A real amplifier's does not — the same input voltage produces a different
 * output depending on what the circuit has just been doing (supply sag, coupling
 * capacitors, transformer hysteresis). No curve, however carefully shaped, can
 * express that, which is the ceiling we kept hitting: every attempt sounded like
 * a fuzz pedal because a memoryless nonlinearity IS a fuzz pedal.
 *
 * An LSTM has state, so it can. These are GuitarML NeuralPi captures: a real amp
 * was recorded playing a known signal and the network was trained to reproduce
 * it. The architecture is deliberately tiny — one layer, 20 hidden units — which
 * is what makes plain JavaScript viable here and means no WASM, no build
 * toolchain, and no third-party runtime.
 *
 * ARCHITECTURE (verified against ToneLibrary/NeuralPi/*.json)
 *   input_size 1, hidden_size 20, num_layers 1, output_size 1, skip 1
 *   y[n] = lin(h[n]) + x[n]        <- the skip connection carries the dry signal
 *
 * PyTorch gate order in weight_ih/weight_hh/bias is [input, forget, cell, output],
 * each block `hidden` rows tall. Getting that order wrong does not error, it just
 * sounds wrong, so it is asserted by the reference test rather than trusted.
 *
 * COST: ~1,700 MAC/sample, dominated by the 20x80 recurrent matrix. One instance
 * on the guitar bus is ~82 MMAC/s at 48 kHz. Everything below is written to
 * allocate nothing inside process().
 */

const HAS_SKIP_DEFAULT = 1

class LstmAmpProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      // Level INTO the model. This matters more than it looks: the network was
      // trained at one specific input level, so this is effectively the amp's
      // gain knob — too low and it stays clean no matter which model is loaded,
      // too high and it turns to mush.
      {
        name: "inputGain",
        defaultValue: 1,
        minValue: 0,
        maxValue: 8,
        automationRate: "k-rate",
      },
      // Make-up on the way out, so swapping models does not change mix balance.
      {
        name: "outputGain",
        defaultValue: 1,
        minValue: 0,
        maxValue: 8,
        automationRate: "k-rate",
      },
    ]
  }

  constructor() {
    super()
    this.ready = false
    this.hidden = 0
    this.skip = HAS_SKIP_DEFAULT
    this.port.onmessage = (e) => {
      const d = e.data
      if (d && d.type === "model") this.setModel(d)
      else if (d && d.type === "reset") this.resetState()
    }
  }

  setModel(d) {
    const h = d.hidden | 0
    this.hidden = h
    this.skip = d.skip ? 1 : 0

    // Flat typed arrays throughout — nested arrays would chase a pointer per
    // element in the inner loop, which is the whole cost of this processor.
    this.wIh = Float32Array.from(d.wIh) // [4h] (input_size is 1)
    this.wHh = Float32Array.from(d.wHh) // [4h][h] row-major
    this.bias = Float32Array.from(d.bias) // b_ih + b_hh pre-summed, [4h]
    this.linW = Float32Array.from(d.linW) // [h]
    this.linB = +d.linB

    this.h = new Float32Array(h)
    this.c = new Float32Array(h)
    this.gates = new Float32Array(4 * h)

    this.ready = true
    this.port.postMessage({ type: "ready", hidden: h })
  }

  resetState() {
    if (!this.ready) return
    this.h.fill(0)
    this.c.fill(0)
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]
    if (!output || output.length === 0) return true

    const inGain = parameters.inputGain[0]
    const outGain = parameters.outputGain[0]
    const frames = output[0].length

    // Not loaded yet: pass audio through untouched rather than dropping the
    // guitar. A silent band is a far worse failure than an unprocessed one.
    if (!this.ready || !input || input.length === 0) {
      for (let ch = 0; ch < output.length; ch++) {
        const dst = output[ch]
        const src = input && input[Math.min(ch, input.length - 1)]
        if (src) dst.set(src)
        else dst.fill(0)
      }
      return true
    }

    const H = this.hidden
    const H2 = H * 2
    const H3 = H * 3
    const wIh = this.wIh
    const wHh = this.wHh
    const bias = this.bias
    const linW = this.linW
    const linB = this.linB
    const hs = this.h
    const cs = this.c
    const gates = this.gates
    const nIn = input.length

    for (let n = 0; n < frames; n++) {
      // An amp has one input. Sum to mono rather than taking channel 0, so a
      // panned or stereo source does not lose half its signal on the way in.
      let x = 0
      for (let ch = 0; ch < nIn; ch++) x += input[ch][n]
      x = (x / nIn) * inGain

      // gates = W_ih·x + W_hh·h + (b_ih + b_hh)
      for (let k = 0; k < gates.length; k++) gates[k] = bias[k] + wIh[k] * x
      for (let k = 0; k < gates.length; k++) {
        const row = k * H
        let acc = 0
        for (let j = 0; j < H; j++) acc += wHh[row + j] * hs[j]
        gates[k] += acc
      }

      let y = linB
      for (let j = 0; j < H; j++) {
        // PyTorch order: i, f, g, o
        const i = 1 / (1 + Math.exp(-gates[j]))
        const f = 1 / (1 + Math.exp(-gates[H + j]))
        const g = Math.tanh(gates[H2 + j])
        const o = 1 / (1 + Math.exp(-gates[H3 + j]))
        const c = f * cs[j] + i * g
        const hj = o * Math.tanh(c)
        cs[j] = c
        hs[j] = hj
        y += linW[j] * hj
      }

      if (this.skip) y += x
      y *= outGain

      for (let ch = 0; ch < output.length; ch++) output[ch][n] = y
    }

    return true
  }
}

registerProcessor("lstm-amp", LstmAmpProcessor)
