import type { SfzInstrument, SfzRegion } from "@/lib/band-jam/engine/types"

/**
 * Loads and decodes the sample files an SfzInstrument references.
 *
 * SAMPLE-RATE HAZARD
 * ------------------
 * SfzRegion.offset / .end are FRAME indices into the original file. The source
 * WAVs are 48 kHz, but AudioContext commonly runs at 44.1 kHz and
 * decodeAudioData resamples on the way in — which invalidates frame indices.
 *
 * Seconds survive resampling; frames do not. So every offset is converted to
 * seconds using the file's ORIGINAL sample rate, never the decoded buffer's.
 * Getting this wrong makes every note start in the wrong place, subtly, in a
 * way that only shows up on hardware whose default rate isn't 48 kHz.
 */

/** All the converted sources are 48 kHz; the manifest can override per file. */
export const DEFAULT_SOURCE_SAMPLE_RATE = 48000

export type LoadedSample = {
  buffer: AudioBuffer
  /** Rate of the file on disk, NOT of the decoded buffer. */
  sourceSampleRate: number
}

export type SampleBankOptions = {
  /** Per-sample overrides, keyed by the region's `sample` path. */
  sourceSampleRates?: Record<string, number>
  /** Called as samples land, for progress UI. */
  onProgress?: (loaded: number, total: number) => void
  fetchImpl?: typeof fetch
}

export class SampleBank {
  private samples = new Map<string, LoadedSample>()
  private inflight = new Map<string, Promise<LoadedSample | null>>()
  private failed = new Set<string>()

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly options: SampleBankOptions = {},
  ) {}

  get(samplePath: string): LoadedSample | null {
    return this.samples.get(samplePath) ?? null
  }

  has(samplePath: string): boolean {
    return this.samples.has(samplePath)
  }

  /** Paths that failed to load; useful for surfacing a partial-instrument warning. */
  getFailures(): string[] {
    return [...this.failed]
  }

  private sourceRateFor(samplePath: string): number {
    return (
      this.options.sourceSampleRates?.[samplePath] ?? DEFAULT_SOURCE_SAMPLE_RATE
    )
  }

  private async loadOne(
    instrument: SfzInstrument,
    samplePath: string,
  ): Promise<LoadedSample | null> {
    const existing = this.samples.get(samplePath)
    if (existing) return existing
    const pending = this.inflight.get(samplePath)
    if (pending) return pending

    const doFetch = this.options.fetchImpl ?? fetch
    const url = joinUrl(instrument.sampleBaseUrl, samplePath)

    const task = (async (): Promise<LoadedSample | null> => {
      try {
        const res = await doFetch(url)
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const raw = await res.arrayBuffer()
        const buffer = await this.ctx.decodeAudioData(raw)
        const loaded: LoadedSample = {
          buffer,
          sourceSampleRate: this.sourceRateFor(samplePath),
        }
        this.samples.set(samplePath, loaded)
        return loaded
      } catch {
        // A missing sample silences one articulation cell, not the instrument.
        this.failed.add(samplePath)
        return null
      } finally {
        this.inflight.delete(samplePath)
      }
    })()

    this.inflight.set(samplePath, task)
    return task
  }

  /** Load every distinct sample the instrument references. */
  async loadInstrument(
    instrument: SfzInstrument,
    concurrency = 8,
  ): Promise<void> {
    const paths = [...new Set(instrument.regions.map((r) => r.sample))].filter(
      (p) => !this.samples.has(p),
    )
    const total = paths.length
    let done = 0

    const queue = [...paths]
    const worker = async () => {
      for (;;) {
        const next = queue.shift()
        if (next === undefined) return
        await this.loadOne(instrument, next)
        done += 1
        this.options.onProgress?.(done, total)
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, Math.max(1, total)) }, worker),
    )
  }
}

/**
 * Region slice bounds in SECONDS. Always derived from the original file rate —
 * see the sample-rate hazard note at the top of this file.
 */
export function regionSliceSeconds(
  region: SfzRegion,
  sample: LoadedSample,
): { offsetSec: number; availableSec: number } {
  const rate = sample.sourceSampleRate
  const offsetSec = Math.max(0, region.offset / rate)
  const endSec =
    region.end >= 0
      ? Math.min(region.end / rate, sample.buffer.duration)
      : sample.buffer.duration
  return {
    offsetSec: Math.min(offsetSec, sample.buffer.duration),
    availableSec: Math.max(0, endSec - offsetSec),
  }
}

function joinUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base
  const p = path.startsWith("/") ? path.slice(1) : path
  return `${b}/${p.split("/").map(encodeURIComponent).join("/")}`
}
