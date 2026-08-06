import {
  INSTRUMENTS_BASE,
  instrumentForRole,
  loadInstrument,
  type LoadedInstrument,
} from "@/lib/band-jam/engine/instruments"

type LoadInstrumentOptions = Parameters<typeof loadInstrument>[2]
type InstrumentLoader = typeof loadInstrument

type CacheEntry = {
  promise: Promise<LoadedInstrument>
  lastUsed: number
  resolved: boolean
}

export type InstrumentRepositoryOptions = {
  /** Soft cap. In-use entries are never force-disposed; old references are released for GC. */
  maxEntries?: number
  loader?: InstrumentLoader
}

/**
 * AudioContext-scoped decoded-instrument cache.
 *
 * AudioBuffers cannot be shared across different AudioContexts reliably, so a repository
 * belongs to exactly one context. It deduplicates concurrent loads and keeps recently used
 * instruments warm when the user returns to a style.
 */
export class InstrumentRepository {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly maxEntries: number
  private readonly loader: InstrumentLoader
  private clock = 0

  constructor(
    private readonly ctx: BaseAudioContext,
    options: InstrumentRepositoryOptions = {},
  ) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 10)
    this.loader = options.loader ?? loadInstrument
  }

  private key(instrumentId: string, baseUrl?: string): string {
    return `${baseUrl ?? INSTRUMENTS_BASE}::${instrumentId}`
  }

  async load(
    instrumentId: string,
    opts: LoadInstrumentOptions = {},
  ): Promise<LoadedInstrument> {
    const key = this.key(instrumentId, opts.baseUrl)
    const existing = this.cache.get(key)
    if (existing) {
      existing.lastUsed = ++this.clock
      const loaded = await existing.promise
      const total = loaded.manifest.sampleCount ?? loaded.instrument.regions.length
      opts.onProgress?.(total, total)
      return loaded
    }

    const entry: CacheEntry = {
      lastUsed: ++this.clock,
      resolved: false,
      promise: Promise.resolve(null as unknown as LoadedInstrument),
    }
    entry.promise = this.loader(this.ctx, instrumentId, opts)
      .then((loaded) => {
        entry.resolved = true
        this.prune()
        return loaded
      })
      .catch((error) => {
        this.cache.delete(key)
        throw error
      })
    this.cache.set(key, entry)
    return entry.promise
  }

  async loadRoles(
    roles: string[],
    opts: LoadInstrumentOptions & {
      styleId?: string
      onInstrumentProgress?: (
        instrumentId: string,
        loaded: number,
        total: number,
      ) => void
    } = {},
  ): Promise<Map<string, LoadedInstrument>> {
    const priority = ["drums", "bass", "keys", "guitar", "solo"]
    const ordered = [...new Set(roles)].sort(
      (a, b) => priority.indexOf(a) - priority.indexOf(b),
    )
    const byInstrument = new Map<string, LoadedInstrument>()
    const out = new Map<string, LoadedInstrument>()

    for (const role of ordered) {
      const instrumentId = instrumentForRole(role, opts.styleId)
      if (!instrumentId) continue
      const alreadyLoaded = byInstrument.get(instrumentId)
      if (alreadyLoaded) {
        out.set(role, alreadyLoaded)
        continue
      }
      const loaded = await this.load(instrumentId, {
        baseUrl: opts.baseUrl,
        fetchImpl: opts.fetchImpl,
        onProgress: (done, total) =>
          opts.onInstrumentProgress?.(instrumentId, done, total),
      })
      byInstrument.set(instrumentId, loaded)
      out.set(role, loaded)
    }
    return out
  }

  has(instrumentId: string, baseUrl?: string): boolean {
    return this.cache.has(this.key(instrumentId, baseUrl))
  }

  clear(): void {
    this.cache.clear()
  }

  private prune(): void {
    if (this.cache.size <= this.maxEntries) return
    const oldest = [...this.cache.entries()]
      .filter(([, entry]) => entry.resolved)
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed)
    for (const [key] of oldest.slice(0, this.cache.size - this.maxEntries)) {
      this.cache.delete(key)
    }
  }
}
