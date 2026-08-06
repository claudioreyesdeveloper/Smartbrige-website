import { describe, expect, it, vi } from "vitest"
import { InstrumentRepository } from "@/lib/band-jam/engine/instrument-repository"
import type { LoadedInstrument } from "@/lib/band-jam/engine/instruments"

const loaded = (id: string): LoadedInstrument =>
  ({
    manifest: { instrumentId: id, label: id, sfzUrl: "x", sampleBaseUrl: "x", sourceSampleRates: {}, sampleCount: 1 },
    instrument: { id, label: id, regions: [], sampleBaseUrl: "x" },
    index: {} as LoadedInstrument["index"],
    bank: { getFailures: () => [] } as unknown as LoadedInstrument["bank"],
    selector: {} as LoadedInstrument["selector"],
    instrumentGain: 1,
  })

describe("InstrumentRepository", () => {
  it("deduplicates concurrent loads for one AudioContext", async () => {
    let resolve!: (value: LoadedInstrument) => void
    const pending = new Promise<LoadedInstrument>((done) => { resolve = done })
    const loader = vi.fn(() => pending)
    const repository = new InstrumentRepository({} as BaseAudioContext, { loader })

    const first = repository.load("guitar-emily")
    const second = repository.load("guitar-emily")
    resolve(loaded("guitar-emily"))

    await expect(first).resolves.toMatchObject({ instrumentGain: 1 })
    await expect(second).resolves.toMatchObject({ instrumentGain: 1 })
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("drops failed loads so retry can succeed", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(loaded("bass-electric"))
    const repository = new InstrumentRepository({} as BaseAudioContext, { loader })

    await expect(repository.load("bass-electric")).rejects.toThrow("network")
    await expect(repository.load("bass-electric")).resolves.toMatchObject({ instrumentGain: 1 })
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
