import type {
  BandStyle,
  NoteEvent,
  Progression,
} from "@/lib/band-jam/engine/types"

/** Search-list representation; generated with an empty sections array. */
export type ProgressionSummary = Progression

export type JamPlayerCatalogIndex = {
  version: number
  buildId: string
  styles: BandStyle[]
  progressions: ProgressionSummary[]
  progressionShards: Record<string, string>
}

export type JamPlayerProgressionShard = {
  buildId: string
  progressions: Record<string, Progression>
}

export type JamPlayerStyleShard = {
  buildId: string
  styleId: string
  clips: Record<string, { sourceKeyPc: number; events: NoteEvent[] }>
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const indexCache = new Map<string, Promise<JamPlayerCatalogIndex>>()
const progressionShardCache = new Map<string, Promise<JamPlayerProgressionShard>>()
const styleShardCache = new Map<string, Promise<JamPlayerStyleShard>>()

async function fetchJson<T>(
  url: string,
  fetcher: FetchLike,
  cache: RequestCache,
): Promise<T> {
  const response = await fetcher(url, { cache })
  if (!response.ok) {
    throw new Error(`Jam Player data request failed (${response.status}): ${url}`)
  }
  return (await response.json()) as T
}

export function loadJamPlayerCatalogIndex(
  fetcher: FetchLike = fetch,
  baseUrl = "/jam-player/data",
): Promise<JamPlayerCatalogIndex> {
  const url = `${baseUrl}/index.json`
  let request = indexCache.get(url)
  if (!request) {
    request = fetchJson<JamPlayerCatalogIndex>(url, fetcher, "no-cache").catch(
      (error) => {
        indexCache.delete(url)
        throw error
      },
    )
    indexCache.set(url, request)
  }
  return request
}

export async function loadJamPlayerProgression(
  index: JamPlayerCatalogIndex,
  progressionId: string,
  fetcher: FetchLike = fetch,
  baseUrl = "/jam-player/data",
): Promise<Progression> {
  const shardName = index.progressionShards[progressionId]
  if (!shardName) throw new Error(`Unknown Jam Player progression: ${progressionId}`)
  const url = `${baseUrl}/progressions/${shardName}?v=${encodeURIComponent(index.buildId)}`
  let request = progressionShardCache.get(url)
  if (!request) {
    request = fetchJson<JamPlayerProgressionShard>(url, fetcher, "force-cache").catch(
      (error) => {
        progressionShardCache.delete(url)
        throw error
      },
    )
    progressionShardCache.set(url, request)
  }
  const shard = await request
  if (shard.buildId !== index.buildId) {
    progressionShardCache.delete(url)
    throw new Error("Jam Player progression data version mismatch")
  }
  const progression = shard.progressions[progressionId]
  if (!progression) {
    throw new Error(`Progression ${progressionId} is absent from ${shardName}`)
  }
  return progression
}

export async function loadJamPlayerStyleClips(
  index: JamPlayerCatalogIndex,
  styleId: string,
  fetcher: FetchLike = fetch,
  baseUrl = "/jam-player/data",
): Promise<Map<number, { sourceKeyPc: number; events: NoteEvent[] }>> {
  const url = `${baseUrl}/styles/${encodeURIComponent(styleId)}.json?v=${encodeURIComponent(index.buildId)}`
  let request = styleShardCache.get(url)
  if (!request) {
    request = fetchJson<JamPlayerStyleShard>(url, fetcher, "force-cache").catch(
      (error) => {
        styleShardCache.delete(url)
        throw error
      },
    )
    styleShardCache.set(url, request)
  }
  const shard = await request
  if (shard.buildId !== index.buildId) {
    styleShardCache.delete(url)
    throw new Error("Jam Player style data version mismatch")
  }
  if (shard.styleId !== styleId) {
    throw new Error(`Style shard mismatch: expected ${styleId}, received ${shard.styleId}`)
  }
  return new Map(
    Object.entries(shard.clips).map(([id, clip]) => [Number(id), clip] as const),
  )
}

/** Tests and explicit content refreshes can clear process-local request caches. */
export function clearJamPlayerCatalogCaches(): void {
  indexCache.clear()
  progressionShardCache.clear()
  styleShardCache.clear()
}
