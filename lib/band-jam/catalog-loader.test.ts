import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearJamPlayerCatalogCaches,
  loadJamPlayerCatalogIndex,
  loadJamPlayerProgression,
  loadJamPlayerStyleClips,
  type JamPlayerCatalogIndex,
} from "@/lib/band-jam/catalog-loader"

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

const index: JamPlayerCatalogIndex = {
  version: 1,
  buildId: "build-1",
  styles: [],
  progressions: [],
  progressionShards: { song: "0a.json" },
}

afterEach(() => clearJamPlayerCatalogCaches())

describe("Jam Player catalogue loader", () => {
  it("deduplicates index and progression shard requests", async () => {
    const progression = {
      id: "song",
      name: "Song",
      keyPc: 0,
      keyLabel: "C",
      sections: [],
    }
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith("index.json")) return response(index)
      return response({ buildId: index.buildId, progressions: { song: progression } })
    })

    const [first, second] = await Promise.all([
      loadJamPlayerCatalogIndex(fetcher),
      loadJamPlayerCatalogIndex(fetcher),
    ])
    expect(first).toEqual(second)
    await Promise.all([
      loadJamPlayerProgression(index, "song", fetcher),
      loadJamPlayerProgression(index, "song", fetcher),
    ])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("returns only the selected style's clips", async () => {
    const fetcher = vi.fn(async () =>
      response({
        buildId: index.buildId,
        styleId: "funk",
        clips: {
          12: { sourceKeyPc: 0, events: [] },
          18: { sourceKeyPc: 5, events: [] },
        },
      }),
    )
    const clips = await loadJamPlayerStyleClips(index, "funk", fetcher)
    expect([...clips.keys()]).toEqual([12, 18])
  })

  it("rejects a stale shard", async () => {
    const fetcher = vi.fn(async () =>
      response({ buildId: "old", styleId: "funk", clips: {} }),
    )
    await expect(loadJamPlayerStyleClips(index, "funk", fetcher)).rejects.toThrow(
      "version mismatch",
    )
  })

  it("does not retain failed requests", async () => {
    const fetcher = vi
      .fn(async () => response({}, 503))
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(response(index))
    await expect(loadJamPlayerCatalogIndex(fetcher)).rejects.toThrow("503")
    await expect(loadJamPlayerCatalogIndex(fetcher)).resolves.toMatchObject({ version: 1 })
  })
})
