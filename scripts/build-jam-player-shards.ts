import { createHash } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { clipIdsForStyle } from "@/lib/band-jam/engine/catalog-integrity"
import type {
  BandStyle,
  NoteEvent,
  Progression,
} from "@/lib/band-jam/engine/types"

type CatalogJson = { styles: BandStyle[]; progressions: Progression[] }
type ClipJson = Record<string, { sourceKeyPc: number; events: NoteEvent[] }>

const ROOT = process.cwd()
const OUT = path.join(ROOT, "public/jam-player/data")
const SHARD_COUNT = 16

function progressionShard(id: string): string {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${(hash >>> 0) % SHARD_COUNT}`.padStart(2, "0") + ".json"
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value)}\n`, "utf8")
}

async function main(): Promise<void> {
  const catalogText = await readFile(
    path.join(ROOT, "lib/band-jam/catalog.generated.json"),
    "utf8",
  )
  const clipsText = await readFile(
    path.join(ROOT, "lib/band-jam/clips.generated.json"),
    "utf8",
  )
  const buildId = createHash("sha256")
    .update(catalogText)
    .update("\0")
    .update(clipsText)
    .digest("hex")
    .slice(0, 16)
  const catalog = JSON.parse(catalogText) as CatalogJson
  const clips = JSON.parse(clipsText) as ClipJson

  await rm(OUT, { recursive: true, force: true })

  const progressionShards: Record<string, string> = {}
  const shardContent = new Map<string, Record<string, Progression>>()
  for (const progression of catalog.progressions) {
    const shardName = progressionShard(progression.id)
    progressionShards[progression.id] = shardName
    const shard = shardContent.get(shardName) ?? {}
    shard[progression.id] = progression
    shardContent.set(shardName, shard)
  }
  for (const [shardName, progressions] of shardContent) {
    await writeJson(path.join(OUT, "progressions", shardName), {
      buildId,
      progressions,
    })
  }

  for (const style of catalog.styles) {
    const selected: ClipJson = {}
    for (const clipId of clipIdsForStyle(style)) {
      const clip = clips[String(clipId)]
      if (clip) selected[String(clipId)] = clip
    }
    await writeJson(path.join(OUT, "styles", `${style.id}.json`), {
      buildId,
      styleId: style.id,
      clips: selected,
    })
  }

  const progressions = catalog.progressions.map(({ sections: _sections, ...summary }) => ({
    ...summary,
    sections: [],
  }))
  await writeJson(path.join(OUT, "index.json"), {
    version: 1,
    buildId,
    styles: catalog.styles,
    progressions,
    progressionShards,
  })

  console.log(
    `Built Jam Player data ${buildId}: ${catalog.styles.length} style shards, ${shardContent.size} progression shards, ${progressions.length} summaries.`,
  )
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
