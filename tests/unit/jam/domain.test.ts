import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  containsForbiddenKeys,
  parseJamPrepareRequest,
  parseJamPrepareResponse,
  parseJamReharmonizeRequest,
  stripForbiddenKeys,
  toEnginePrepareRequest,
} from "@/lib/jam/domain"

const contractsDir = path.join(process.cwd(), "contracts", "v1")

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(contractsDir, name), "utf8"))
}

describe("jam domain validation", () => {
  it("parses public prepare requests and strips projectId for the engine body", () => {
    const engineBody = fixture("jam-prepare.request.json") as Record<string, unknown>
    const parsed = parseJamPrepareRequest({
      projectId: "proj_abc",
      ...engineBody,
    })
    expect(parsed.projectId).toBe("proj_abc")
    expect(toEnginePrepareRequest(parsed)).toEqual(engineBody)
  })

  it("rejects unsupported keyboard models and unknown fields", () => {
    expect(() =>
      parseJamPrepareRequest({
        projectId: "proj_1",
        model: "motif",
        song: (fixture("jam-prepare.request.json") as { song: unknown }).song,
      }),
    ).toThrow(/keyboard model/)

    expect(() =>
      parseJamPrepareRequest({
        projectId: "proj_1",
        model: "genos2",
        song: (fixture("jam-prepare.request.json") as { song: unknown }).song,
        seed: 42,
      }),
    ).toThrow(/Unknown field/)
  })

  it("requires sectionId for section-scoped reharmonize", () => {
    expect(() =>
      parseJamReharmonizeRequest({
        projectId: "proj_1",
        model: "genos2",
        scope: "section",
        key: "C",
        chords: [{ symbol: "C", startBar: 0, durationBars: 2 }],
      }),
    ).toThrow(/sectionId/)
  })

  it("strips forbidden internal keys from backend payloads", () => {
    const base = fixture("jam-prepare.response.json") as Record<string, unknown>
    const dirty = {
      ...base,
      seed: 99,
      recipe: { hidden: true },
      rankingScore: 0.9,
      nested: { trace: ["x"], keep: 1 },
    }
    expect(containsForbiddenKeys(dirty)).toEqual(
      expect.arrayContaining(["recipe", "rankingScore", "seed", "trace"]),
    )
    const cleaned = stripForbiddenKeys(dirty) as Record<string, unknown>
    expect(cleaned).not.toHaveProperty("seed")
    expect(cleaned).not.toHaveProperty("recipe")
    expect(cleaned.nested).toEqual({ keep: 1 })
    // Whitelist parse drops unknown keys such as nested by rejecting them.
    const { nested: _nested, ...publicSafe } = cleaned
    expect(parseJamPrepareResponse(publicSafe).planId).toBe("pln_fixture_0001")
  })

  it("drops unknown response fields via whitelist parse", () => {
    const base = fixture("jam-prepare.response.json") as Record<string, unknown>
    expect(() =>
      parseJamPrepareResponse({
        ...base,
        sourcePhraseId: "phrase-9",
        engineDebug: true,
      }),
    ).toThrow(/Unknown field/)
  })
})
