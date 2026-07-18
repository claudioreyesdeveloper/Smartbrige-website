import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  FORBIDDEN_RESPONSE_KEYS,
  containsForbiddenKeys,
  parseJamPrepareRequest,
  parseJamPrepareResponse,
  parseJamReharmonizeRequest,
  parseJamReharmonizeResponse,
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
      sourceClipId: "clip-internal",
      sourceSongId: "song-internal",
      patternPool: ["private"],
      techniques: ["private"],
      explanation: "private",
      melodyFeatures: { private: true },
      romanTimingsJson: "{}",
      nested: { trace: ["x"], keep: 1 },
    }
    expect(containsForbiddenKeys(dirty)).toEqual(
      expect.arrayContaining([
        "explanation",
        "melodyFeatures",
        "patternPool",
        "recipe",
        "rankingScore",
        "romanTimingsJson",
        "seed",
        "sourceClipId",
        "sourceSongId",
        "techniques",
        "trace",
      ]),
    )
    const cleaned = stripForbiddenKeys(dirty) as Record<string, unknown>
    expect(cleaned).not.toHaveProperty("seed")
    expect(cleaned).not.toHaveProperty("recipe")
    expect(cleaned).not.toHaveProperty("sourceClipId")
    expect(cleaned).not.toHaveProperty("melodyFeatures")
    expect(cleaned.nested).toEqual({ keep: 1 })
    expect(parseJamPrepareResponse(cleaned).planId).toBe("pln_fixture_0001")
  })

  it("drops unknown response fields via whitelist parse", () => {
    const base = fixture("jam-prepare.response.json") as Record<string, unknown>
    const parsed = parseJamPrepareResponse({
      ...base,
      sourcePhraseId: "phrase-9",
      engineDebug: true,
    })
    expect(parsed).not.toHaveProperty("sourcePhraseId")
    expect(parsed).not.toHaveProperty("engineDebug")
  })

  const clientForbiddenFields = [
    ...new Set([
      ...FORBIDDEN_RESPONSE_KEYS,
      "subjectId",
      "style",
      "sectionName",
      "sectionClass",
      "category",
      "bars",
      "beatsPerBar",
      "nextSectionFirstChord",
      "preserveCadence",
    ]),
  ]

  it.each(clientForbiddenFields)(
    "never accepts client-controlled %s",
    (field) => {
      expect(() =>
        parseJamReharmonizeRequest({
          projectId: "proj_1",
          model: "genos2",
          scope: "song",
          key: "C",
          chords: [{ symbol: "C", startBar: 0, durationBars: 2 }],
          [field]: "proprietary-probe",
        }),
      ).toThrow(/Unknown field/)
    },
  )

  it("rejects malformed, overpadded, and oversized dispatch base64", () => {
    const base = fixture("jam-prepare.response.json") as {
      dispatch: { fullSong: Array<Record<string, unknown>> }
    } & Record<string, unknown>
    for (const bytes of ["AAAA=", "AA===", "AA-_"]) {
      expect(() =>
        parseJamPrepareResponse({
          ...base,
          dispatch: {
            ...base.dispatch,
            fullSong: [{ ...base.dispatch.fullSong[0], bytes }],
          },
        }),
      ).toThrow(/base64|format/)
    }

    const max = Buffer.alloc(12_288, 1).toString("base64")
    expect(
      parseJamPrepareResponse({
        ...base,
        dispatch: {
          ...base.dispatch,
          fullSong: [{ ...base.dispatch.fullSong[0], bytes: max }],
        },
      }).dispatch.fullSong[0]?.bytes,
    ).toBe(max)

    const tooLarge = Buffer.alloc(12_289, 1).toString("base64")
    expect(() =>
      parseJamPrepareResponse({
        ...base,
        dispatch: {
          ...base.dispatch,
          fullSong: [{ ...base.dispatch.fullSong[0], bytes: tooLarge }],
        },
      }),
    ).toThrow(/max length|12288/)
  })

  it("preserves optional candidate labels without inventing a fallback", () => {
    const withLabel = parseJamReharmonizeResponse(fixture("jam-reharmonize.response.json"))
    expect(withLabel.candidates[0]?.label).toBe("Rich chords")

    const withoutLabel = parseJamReharmonizeResponse({
      generationId: "gen_1",
      candidates: [
        {
          id: "cand_1",
          chords: [{ symbol: "C", startBar: 0, durationBars: 1 }],
        },
      ],
    })
    expect(withoutLabel.candidates[0]).not.toHaveProperty("label")
  })
})
