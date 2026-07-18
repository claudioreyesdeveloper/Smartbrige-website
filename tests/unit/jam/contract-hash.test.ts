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
      "8fd680396b85f610087c65c5edcf3ae33554f11163d4f3db9cf5e183db619aa3",
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
    expect(parseJamReharmonizeResponse(reharmonize).generationId).toBe("gen_fixture_0001")
  })
})
