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
      "05e583863ae44c9d8f110fb6d8c7df9ba6982af1af020b83b2b658935c224145",
    )
  })

  it("parses Solo and Lyrics fixtures with the pinned public schemas", async () => {
    const {
      lyricFitResponseSchema,
      lyricFitEngineRequestSchema,
      lyricGenerateResponseSchema,
      lyricGenerateEngineRequestSchema,
      soloGenerateEngineRequestSchema,
      soloGenerateResponseSchema,
      soloOptionsEngineRequestSchema,
      soloOptionsResponseSchema,
      soloRenderEngineRequestSchema,
      soloRenderResponseSchema,
    } = await import("@/lib/creative/contracts")
    const read = (name: string) =>
      JSON.parse(readFileSync(path.join(contractsDir, name), "utf8"))
    expect(soloOptionsEngineRequestSchema.parse(read("solo-options.request.json")).projectId).toBeTruthy()
    expect(soloGenerateEngineRequestSchema.parse(read("solo-generate.request.json")).context.bars).toBe(4)
    expect(soloRenderEngineRequestSchema.parse(read("solo-render.request.json")).takeId).toBeTruthy()
    expect(lyricGenerateEngineRequestSchema.parse(read("lyrics-generate.request.json")).prosody.phrases).toHaveLength(1)
    expect(lyricFitEngineRequestSchema.parse(read("lyrics-fit.request.json")).notes).toHaveLength(3)
    expect(soloOptionsResponseSchema.parse(read("solo-options.response.json")).styles).toHaveLength(1)
    expect(soloGenerateResponseSchema.parse(read("solo-generate.response.json")).takes).toHaveLength(3)
    expect(soloRenderResponseSchema.parse(read("solo-render.response.json")).renderId).toBeTruthy()
    expect(lyricGenerateResponseSchema.parse(read("lyrics-generate.response.json")).lines).toHaveLength(1)
    expect(lyricFitResponseSchema.parse(read("lyrics-fit.response.json")).phrases).toHaveLength(1)
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
