import type { BandPart } from "@/lib/band-jam/types"

export type StemBuffers = Partial<Record<BandPart, AudioBuffer>>

export type StemPlayerStatus = "idle" | "loading" | "ready" | "playing"

/**
 * Multi-stem Web Audio player. Mute = skip scheduling that stem.
 * Sounds come from pre-rendered PSR-S900 SFZ WAVs (Option A).
 */
export class StemPlayer {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers: StemBuffers = {}
  private sources: AudioBufferSourceNode[] = []
  private startedAt = 0
  private offset = 0
  private _loop = true
  private muted: Set<BandPart> = new Set()
  private duration = 0
  private status: StemPlayerStatus = "idle"
  private onStatus?: (s: StemPlayerStatus) => void

  setStatusListener(fn: (s: StemPlayerStatus) => void) {
    this.onStatus = fn
  }

  private setStatus(s: StemPlayerStatus) {
    this.status = s
    this.onStatus?.(s)
  }

  getStatus() {
    return this.status
  }

  getDuration() {
    return this.duration
  }

  getCurrentTime() {
    if (!this.ctx || this.status !== "playing") return this.offset
    const t = this.ctx.currentTime - this.startedAt + this.offset
    if (this._loop && this.duration > 0) return t % this.duration
    return Math.min(t, this.duration)
  }

  setLoop(loop: boolean) {
    this._loop = loop
  }

  setMuted(part: BandPart, muted: boolean) {
    if (muted) this.muted.add(part)
    else this.muted.delete(part)
    if (this.status === "playing") {
      const t = this.getCurrentTime()
      this.stopSources()
      this.offset = t
      this.startSources(t)
    }
  }

  isMuted(part: BandPart) {
    return this.muted.has(part)
  }

  async ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.9
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === "suspended") await this.ctx.resume()
    return this.ctx
  }

  async load(stems: Partial<Record<BandPart, string>>) {
    this.stop()
    this.setStatus("loading")
    const ctx = await this.ensureContext()
    const next: StemBuffers = {}
    let maxDur = 0
    await Promise.all(
      (Object.entries(stems) as [BandPart, string][]).map(async ([part, url]) => {
        if (!url) return
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to load stem ${part}: ${res.status}`)
        const raw = await res.arrayBuffer()
        const buf = await ctx.decodeAudioData(raw.slice(0))
        next[part] = buf
        maxDur = Math.max(maxDur, buf.duration)
      }),
    )
    this.buffers = next
    this.duration = maxDur
    this.offset = 0
    this.setStatus("ready")
  }

  play() {
    if (!this.ctx || !this.master || this.status === "loading") return
    if (this.status === "playing") return
    void this.ctx.resume()
    this.startSources(this.offset)
    this.setStatus("playing")
  }

  pause() {
    if (this.status !== "playing" || !this.ctx) return
    this.offset = this.getCurrentTime()
    this.stopSources()
    this.setStatus("ready")
  }

  stop() {
    this.stopSources()
    this.offset = 0
    if (this.status === "playing" || this.status === "ready") this.setStatus("ready")
  }

  private startSources(offset: number) {
    if (!this.ctx || !this.master) return
    this.sources = []
    this.startedAt = this.ctx.currentTime
    for (const [part, buf] of Object.entries(this.buffers) as [BandPart, AudioBuffer][]) {
      if (this.muted.has(part) || !buf) continue
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      src.loop = this._loop
      src.connect(this.master)
      const startOffset = Math.min(Math.max(0, offset), Math.max(0, buf.duration - 0.01))
      src.start(0, startOffset)
      this.sources.push(src)
    }
  }

  private stopSources() {
    for (const src of this.sources) {
      try {
        src.stop()
      } catch {
        /* already stopped */
      }
      try {
        src.disconnect()
      } catch {
        /* ignore */
      }
    }
    this.sources = []
  }

  dispose() {
    this.stop()
    void this.ctx?.close()
    this.ctx = null
    this.master = null
    this.buffers = {}
    this.setStatus("idle")
  }
}
