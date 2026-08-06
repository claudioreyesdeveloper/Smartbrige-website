import { readFile } from "node:fs/promises"
import path from "node:path"
import catalogJson from "@/lib/band-jam/catalog.generated.json"
import clipsJson from "@/lib/band-jam/clips.generated.json"
import { validateJamPlayerCatalog } from "@/lib/band-jam/engine/catalog-integrity"
import type {
  JamPlayerCatalogIndex,
  JamPlayerProgressionShard,
  JamPlayerStyleShard,
} from "@/lib/band-jam/catalog-loader"
import type {
  BandStyle,
  NoteEvent,
  Progression,
} from "@/lib/band-jam/engine/types"

type CatalogJson = { styles: BandStyle[]; progressions: Progression[] }
type ClipJson = Record<string, { sourceKeyPc: number; events: NoteEvent[] }>

async function main(): Promise<void> {
  const root = process.cwd()
  const catalog = catalogJson as unknown as CatalogJson
  const rawClips = clipsJson as ClipJson
  const clips = new Map(
    Object.entries(rawClips).map(([id, clip]) => [Number(id), clip] as const),
  )
  const issues = validateJamPlayerCatalog(catalog.styles, catalog.progressions, clips)

  const index = JSON.parse(
    await readFile(path.join(root, "public/jam-player/data/index.json"), "utf8"),
  ) as JamPlayerCatalogIndex

  if (index.progressions.some((progression) => progression.sections.length !== 0)) {
    issues.push({
      kind: "invalid_clip",
      message: "Catalogue index contains full progression sections instead of summaries.",
    })
  }
  if (index.progressions.length !== catalog.progressions.length) {
    issues.push({
      kind: "empty_progression",
      message: `Catalogue index has ${index.progressions.length} progression summaries; expected ${catalog.progressions.length}.`,
    })
  }

  for (const style of catalog.styles) {
    const shard = JSON.parse(
      await readFile(
        path.join(root, "public/jam-player/data/styles", `${style.id}.json`),
        "utf8",
      ),
    ) as JamPlayerStyleShard
    if (shard.buildId !== index.buildId || shard.styleId !== style.id) {
      issues.push({
        kind: "invalid_clip",
        message: `Style shard ${style.id} does not match index build ${index.buildId}.`,
      })
      continue
    }
    const shardClips = new Map(
      Object.entries(shard.clips).map(([id, clip]) => [Number(id), clip] as const),
    )
    issues.push(...validateJamPlayerCatalog([style], [], shardClips))
  }

  const checkedProgressionShards = new Map<string, JamPlayerProgressionShard>()
  for (const progression of catalog.progressions) {
    const shardName = index.progressionShards[progression.id]
    if (!shardName) {
      issues.push({
        kind: "empty_progression",
        message: `Progression ${progression.id} has no shard mapping.`,
      })
      continue
    }
    let shard = checkedProgressionShards.get(shardName)
    if (!shard) {
      shard = JSON.parse(
        await readFile(
          path.join(root, "public/jam-player/data/progressions", shardName),
          "utf8",
        ),
      ) as JamPlayerProgressionShard
      checkedProgressionShards.set(shardName, shard)
    }
    if (shard.buildId !== index.buildId) {
      issues.push({
        kind: "empty_progression",
        message: `Progression shard ${shardName} does not match index build ${index.buildId}.`,
      })
    }
    const sharded = shard.progressions[progression.id]
    if (!sharded || sharded.sections.length === 0) {
      issues.push({
        kind: "empty_progression",
        message: `Progression ${progression.id} is missing or empty in ${shardName}.`,
      })
    }
  }

  if (issues.length > 0) {
    console.error(`Jam Player catalogue validation failed with ${issues.length} issue(s):`)
    for (const issue of issues) console.error(`- ${issue.message}`)
    process.exitCode = 1
  } else {
    console.log(
      `Jam Player catalogue valid: build ${index.buildId}, ${catalog.styles.length} styles, ${catalog.progressions.length} progressions, ${clips.size} clips, ${checkedProgressionShards.size} progression shards.`,
    )
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
