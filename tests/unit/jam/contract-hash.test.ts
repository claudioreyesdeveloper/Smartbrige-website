import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const contractsDir = path.join(process.cwd(), "contracts", "v1")

function computeHash(): string {
  const files = readdirSync(contractsDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
  const hash = createHash("sha256")
  for (const name of files) {
    hash.update(name)
    hash.update("\0")
    hash.update(readFileSync(path.join(contractsDir, name)))
    hash.update("\0")
  }
  return hash.digest("hex")
}

describe("jam v1 contract fixtures", () => {
  it("matches CONTRACT_HASH.txt for private algorithm-service parity", () => {
    const expected = readFileSync(path.join(contractsDir, "CONTRACT_HASH.txt"), "utf8").trim()
    expect(computeHash()).toBe(expected)
    expect(expected).toBe(
      "6462580c1279eb08aaedc3be85439f41365a6988d6c45f1e0fbfa3b5a3f19eb1",
    )
  })

  it("fixture prepare/reharmonize shapes parse as public-safe responses", async () => {
    const { parseJamPrepareResponse, parseJamReharmonizeResponse } = await import(
      "@/lib/jam/domain/validate"
    )
    const prepare = JSON.parse(
      readFileSync(path.join(contractsDir, "jam-prepare.response.json"), "utf8"),
    )
    const reharmonize = JSON.parse(
      readFileSync(path.join(contractsDir, "jam-reharmonize.response.json"), "utf8"),
    )
    expect(parseJamPrepareResponse(prepare).planId).toBe("pln_fixture_0001")
    const parsed = parseJamReharmonizeResponse(reharmonize)
    expect(parsed.generationId).toBe("gen_fixture_0001")
    expect(parsed.candidates[0]?.label).toBe("Rich chords")
  })

  it("parses final rhythm fixtures without forbidden private fields", async () => {
    const {
      parseRhythmFillsResponse,
      parseRhythmOptionsResponse,
      parseRhythmQueryResponse,
      parseRhythmRenderResponse,
    } = await import("@/lib/rhythm/domain")
    const { containsForbiddenKeys } = await import("@/lib/jam/domain/forbidden")
    const read = (name: string) =>
      JSON.parse(readFileSync(path.join(contractsDir, name), "utf8"))
    const responses = [
      parseRhythmOptionsResponse(read("rhythm-options.response.json")),
      parseRhythmQueryResponse(read("rhythm-query.response.json")),
      parseRhythmFillsResponse(read("rhythm-fills.response.json")),
      parseRhythmRenderResponse(read("rhythm-render.response.json")),
    ]
    expect(responses.map(containsForbiddenKeys)).toEqual([[], [], [], []])
  })
})
