import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { containsForbiddenKeys } from "@/lib/jam/domain/forbidden"

function files(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const entry = path.join(root, name)
    return statSync(entry).isDirectory() ? files(entry) : [entry]
  })
}

describe("creative bridge private-data leak scan", () => {
  it("keeps all mirrored response fixtures free of forbidden private keys", () => {
    const contracts = path.join(process.cwd(), "contracts", "v1")
    const responses = readdirSync(contracts)
      .filter((name) => name.endsWith(".response.json"))
      .map((name) => JSON.parse(readFileSync(path.join(contracts, name), "utf8")))
    expect(responses.flatMap(containsForbiddenKeys)).toEqual([])
  })

  it("contains no proprietary implementation vocabulary in creative browser code", () => {
    const roots = [
      path.join(process.cwd(), "components", "solo-phrases"),
      path.join(process.cwd(), "components", "lyrics"),
      path.join(process.cwd(), "app", "api", "engine", "solo"),
      path.join(process.cwd(), "app", "api", "engine", "lyrics"),
    ]
    const source = roots.flatMap(files).map((name) => readFileSync(name, "utf8")).join("\n")
    const forbidden = [
      "sourcePhraseId",
      "sourcePath",
      "rankingScore",
      "privateRecipe",
      "systemPrompt",
      "providerRequest",
      "dictionary",
      "phonemes",
      "stressPattern",
      "analysedNotes",
      "slotMap",
      "capacityMap",
    ]
    for (const term of forbidden) expect(source).not.toContain(term)
  })
})
