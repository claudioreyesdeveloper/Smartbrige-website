/*
 * Stereo Dattorro plate/room reverb for SmartBridge.
 *
 * Adapted from Khoi Nguyen's public-domain DattorroReverbNode:
 * https://github.com/khoin/DattorroReverbNode
 *
 * The processor is deliberately 100% wet. SmartBridge already owns the dry
 * signal and feeds this node from a post-fader send bus.
 */

class SmartBridgeDattorroReverb extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      ["preDelay", 0, 0, sampleRate - 1],
      ["bandwidth", 0.9999, 0, 1],
      ["inputDiffusion1", 0.75, 0, 1],
      ["inputDiffusion2", 0.625, 0, 1],
      ["decay", 0.5, 0, 1],
      ["decayDiffusion1", 0.7, 0, 0.999999],
      ["decayDiffusion2", 0.5, 0, 0.999999],
      ["damping", 0.005, 0, 1],
      ["excursionRate", 0.5, 0, 2],
      ["excursionDepth", 0.7, 0, 2],
      ["wet", 1, 0, 1],
      ["dry", 0, 0, 1],
    ].map(([name, defaultValue, minValue, maxValue]) => ({
      name,
      defaultValue,
      minValue,
      maxValue,
      automationRate: "k-rate",
    }))
  }

  constructor() {
    super()
    this.delays = []
    this.preDelayLength = sampleRate + (128 - (sampleRate % 128))
    this.preDelay = new Float32Array(this.preDelayLength)
    this.preDelayWrite = 0
    this.lowPass1 = 0
    this.lowPass2 = 0
    this.lowPass3 = 0
    this.excursionPhase = 0

    ;[
      0.004771345,
      0.003595309,
      0.012734787,
      0.009307483,
      0.022579886,
      0.149625349,
      0.060481839,
      0.1249958,
      0.030509727,
      0.141695508,
      0.089244313,
      0.106280031,
    ].forEach((seconds) => this.makeDelay(seconds))

    this.taps = Int16Array.from(
      [
        0.008937872,
        0.099929438,
        0.064278754,
        0.067067639,
        0.066866033,
        0.006283391,
        0.035818689,
        0.011861161,
        0.121870905,
        0.041262054,
        0.08981553,
        0.070931756,
        0.011256342,
        0.004065724,
      ],
      (seconds) => Math.round(seconds * sampleRate),
    )
  }

  makeDelay(seconds) {
    const length = Math.round(seconds * sampleRate)
    const storageLength = 2 ** Math.ceil(Math.log2(length))
    this.delays.push([
      new Float32Array(storageLength),
      length - 1,
      0,
      storageLength - 1,
    ])
  }

  writeDelay(index, value) {
    const delay = this.delays[index]
    delay[0][delay[1]] = value
    return value
  }

  readDelay(index) {
    const delay = this.delays[index]
    return delay[0][delay[2]]
  }

  readDelayAt(index, offset) {
    const delay = this.delays[index]
    return delay[0][(delay[2] + offset) & delay[3]]
  }

  readDelayCubicAt(index, offset) {
    const delay = this.delays[index]
    const fraction = offset - Math.trunc(offset)
    let position = Math.trunc(offset) + delay[2] - 1
    const mask = delay[3]
    const x0 = delay[0][position++ & mask]
    const x1 = delay[0][position++ & mask]
    const x2 = delay[0][position++ & mask]
    const x3 = delay[0][position & mask]
    const a = (3 * (x1 - x2) - x0 + x3) / 2
    const b = 2 * x2 + x0 - (5 * x1 + x3) / 2
    const c = (x2 - x0) / 2
    return ((a * fraction + b) * fraction + c) * fraction + x1
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]
    if (!output?.[0] || !output?.[1]) return true

    const frames = output[0].length
    const preDelaySamples = Math.trunc(parameters.preDelay[0])
    const bandwidth = parameters.bandwidth[0]
    const inputDiffusion1 = parameters.inputDiffusion1[0]
    const inputDiffusion2 = parameters.inputDiffusion2[0]
    const decay = parameters.decay[0]
    const decayDiffusion1 = parameters.decayDiffusion1[0]
    const decayDiffusion2 = parameters.decayDiffusion2[0]
    const damping = 1 - parameters.damping[0]
    const excursionRate = parameters.excursionRate[0] / sampleRate
    const excursionDepth =
      (parameters.excursionDepth[0] * sampleRate) / 1000
    const wet = parameters.wet[0] * 0.6
    const dry = parameters.dry[0]

    const leftInput = input?.[0]
    const rightInput = input?.[1]
    for (let frame = 0; frame < frames; frame += 1) {
      const left = leftInput?.[frame] ?? 0
      const right = rightInput?.[frame] ?? left
      this.preDelay[(this.preDelayWrite + frame) % this.preDelayLength] =
        rightInput ? (left + right) * 0.5 : left
      output[0][frame] = left * dry
      output[1][frame] = right * dry
    }

    for (let frame = 0; frame < frames; frame += 1) {
      const readPosition =
        (this.preDelayLength +
          this.preDelayWrite -
          preDelaySamples +
          frame) %
        this.preDelayLength
      this.lowPass1 +=
        bandwidth * (this.preDelay[readPosition] - this.lowPass1)

      let pre = this.writeDelay(
        0,
        this.lowPass1 - inputDiffusion1 * this.readDelay(0),
      )
      pre = this.writeDelay(
        1,
        inputDiffusion1 * (pre - this.readDelay(1)) + this.readDelay(0),
      )
      pre = this.writeDelay(
        2,
        inputDiffusion1 * pre +
          this.readDelay(1) -
          inputDiffusion2 * this.readDelay(2),
      )
      pre = this.writeDelay(
        3,
        inputDiffusion2 * (pre - this.readDelay(3)) + this.readDelay(2),
      )
      const split = inputDiffusion2 * pre + this.readDelay(3)

      const excursionLeft =
        excursionDepth * (1 + Math.cos(this.excursionPhase * 6.28))
      const excursionRight =
        excursionDepth * (1 + Math.sin(this.excursionPhase * 6.2847))

      let temp = this.writeDelay(
        4,
        split +
          decay * this.readDelay(11) +
          decayDiffusion1 * this.readDelayCubicAt(4, excursionLeft),
      )
      this.writeDelay(
        5,
        this.readDelayCubicAt(4, excursionLeft) - decayDiffusion1 * temp,
      )
      this.lowPass2 += damping * (this.readDelay(5) - this.lowPass2)
      temp = this.writeDelay(
        6,
        decay * this.lowPass2 - decayDiffusion2 * this.readDelay(6),
      )
      this.writeDelay(7, this.readDelay(6) + decayDiffusion2 * temp)

      temp = this.writeDelay(
        8,
        split +
          decay * this.readDelay(7) +
          decayDiffusion1 * this.readDelayCubicAt(8, excursionRight),
      )
      this.writeDelay(
        9,
        this.readDelayCubicAt(8, excursionRight) - decayDiffusion1 * temp,
      )
      this.lowPass3 += damping * (this.readDelay(9) - this.lowPass3)
      temp = this.writeDelay(
        10,
        decay * this.lowPass3 - decayDiffusion2 * this.readDelay(10),
      )
      this.writeDelay(11, this.readDelay(10) + decayDiffusion2 * temp)

      const left =
        this.readDelayAt(9, this.taps[0]) +
        this.readDelayAt(9, this.taps[1]) -
        this.readDelayAt(10, this.taps[2]) +
        this.readDelayAt(11, this.taps[3]) -
        this.readDelayAt(5, this.taps[4]) -
        this.readDelayAt(6, this.taps[5]) -
        this.readDelayAt(7, this.taps[6])
      const right =
        this.readDelayAt(5, this.taps[7]) +
        this.readDelayAt(5, this.taps[8]) -
        this.readDelayAt(6, this.taps[9]) +
        this.readDelayAt(7, this.taps[10]) -
        this.readDelayAt(9, this.taps[11]) -
        this.readDelayAt(10, this.taps[12]) -
        this.readDelayAt(11, this.taps[13])

      output[0][frame] += left * wet
      output[1][frame] += right * wet
      this.excursionPhase += excursionRate

      for (const delay of this.delays) {
        delay[1] = (delay[1] + 1) & delay[3]
        delay[2] = (delay[2] + 1) & delay[3]
      }
    }

    this.preDelayWrite =
      (this.preDelayWrite + frames) % this.preDelayLength
    return true
  }
}

registerProcessor("smartbridge-dattorro-reverb", SmartBridgeDattorroReverb)
