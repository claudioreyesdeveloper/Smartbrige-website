/**
 * Loader for GuitarML NeuralPi amp captures.
 *
 * Turns the published `.json` (PyTorch `state_dict` dumped as nested arrays)
 * into the flat typed arrays `lstm-amp.worklet.js` wants. All the reshaping
 * happens ONCE here, on the main thread, so the audio thread only ever walks
 * contiguous Float32Arrays.
 *
 * See public/jam-player/amp/lstm-amp.worklet.js for why the model is an LSTM
 * and not a waveshaper.
 */

/** Shape of a published NeuralPi model file. */
type NeuralPiModel = {
  model_data: {
    model?: string
    unit_type: string
    num_layers: number
    input_size: number
    hidden_size: number
    output_size: number
    skip: number
  }
  state_dict: {
    "rec.weight_ih_l0": number[][]
    "rec.weight_hh_l0": number[][]
    "rec.bias_ih_l0": number[]
    "rec.bias_hh_l0": number[]
    "lin.weight": number[][]
    "lin.bias": number[]
  }
}

/** What the worklet needs, already flattened. */
export type AmpWeights = {
  hidden: number
  skip: boolean
  /** [4h] — input_size is 1, so each row collapses to a scalar. */
  wIh: Float32Array
  /** [4h][h] row-major. */
  wHh: Float32Array
  /** [4h] — b_ih and b_hh summed; they are only ever used added together. */
  bias: Float32Array
  /** [h] */
  linW: Float32Array
  linB: number
}

export class AmpModelError extends Error {}

/**
 * Validate and flatten. Every check here corresponds to a way the model can be
 * wrong that produces plausible-sounding audio rather than an error — a 2-layer
 * model silently using only its first layer, say. Better to refuse to load.
 */
export function parseAmpModel(raw: unknown, label = "model"): AmpWeights {
  const m = raw as NeuralPiModel
  const md = m?.model_data
  const sd = m?.state_dict
  if (!md || !sd) throw new AmpModelError(`${label}: not a NeuralPi model file`)

  if (md.unit_type !== "LSTM")
    throw new AmpModelError(`${label}: unit_type ${md.unit_type}, expected LSTM`)
  if (md.num_layers !== 1)
    throw new AmpModelError(`${label}: ${md.num_layers} layers, only 1 supported`)
  if (md.input_size !== 1 || md.output_size !== 1)
    throw new AmpModelError(`${label}: expected mono in/out`)

  const h = md.hidden_size
  const ih = sd["rec.weight_ih_l0"]
  const hh = sd["rec.weight_hh_l0"]
  const bIh = sd["rec.bias_ih_l0"]
  const bHh = sd["rec.bias_hh_l0"]
  const linW = sd["lin.weight"]?.[0]
  const linB = sd["lin.bias"]?.[0]

  if (ih?.length !== 4 * h || hh?.length !== 4 * h)
    throw new AmpModelError(`${label}: recurrent weights do not match hidden=${h}`)
  if (bIh?.length !== 4 * h || bHh?.length !== 4 * h)
    throw new AmpModelError(`${label}: bias length does not match hidden=${h}`)
  if (linW?.length !== h || typeof linB !== "number")
    throw new AmpModelError(`${label}: bad output layer`)

  const wIh = new Float32Array(4 * h)
  for (let k = 0; k < 4 * h; k++) wIh[k] = ih[k][0]

  const wHh = new Float32Array(4 * h * h)
  for (let k = 0; k < 4 * h; k++) {
    const row = hh[k]
    if (row.length !== h)
      throw new AmpModelError(`${label}: recurrent row ${k} has width ${row.length}`)
    wHh.set(row, k * h)
  }

  // b_ih and b_hh only ever appear summed, so fold them now and save 80 adds
  // per sample on the audio thread.
  const bias = new Float32Array(4 * h)
  for (let k = 0; k < 4 * h; k++) bias[k] = bIh[k] + bHh[k]

  return {
    hidden: h,
    skip: !!md.skip,
    wIh,
    wHh,
    bias,
    linW: Float32Array.from(linW),
    linB,
  }
}

export function ampModelUrl(name: string): string {
  return `/jam-player/amp/${name}.json`
}

export async function fetchAmpModel(
  name: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AmpWeights> {
  const url = ampModelUrl(name)
  const res = await fetchImpl(url)
  if (!res.ok) throw new AmpModelError(`${name}: HTTP ${res.status} from ${url}`)
  return parseAmpModel(await res.json(), name)
}

/** Message payload for the worklet. Buffers are transferred, not copied. */
export function ampModelMessage(w: AmpWeights) {
  return {
    type: "model" as const,
    hidden: w.hidden,
    skip: w.skip,
    wIh: w.wIh,
    wHh: w.wHh,
    bias: w.bias,
    linW: w.linW,
    linB: w.linB,
  }
}
