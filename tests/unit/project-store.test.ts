import { describe, expect, it } from "vitest"
import { StyleMakerLane } from "@/lib/style-maker/lanes"
import {
  assertProjectName,
  base64ToBytes,
  bytesToBase64,
  isUniqueViolation,
  parseWriteBody,
  sanitizeProjectName,
  STYLE_MAKER_PROJECT_MAX_BYTES,
  writeBodyFromSnapshot,
  snapshotFromProjectWire,
} from "@/lib/style-maker/project-store"
import type { StyleMakerWorkspaceSnapshot } from "@/lib/style-maker/workspace-cache"

function sampleSnapshot(): StyleMakerWorkspaceSnapshot {
  return {
    version: 2,
    savedAt: 1,
    donorFileName: "EasyPop.prs",
    donorBytes: new Uint8Array([1, 2, 3, 4, 5]),
    sectionName: "Main A",
    bars: 2,
    includeCC: true,
    selectedLane: StyleMakerLane.Bass,
    libTab: "bass",
    sectionAssignments: {
      "Main A": {
        [StyleMakerLane.Bass]: {
          title: "Funk",
          subtitle: "library",
          notes: [{ tick: 0, duration: 48, note: 36, velocity: 90 }],
          cycleTicks: 384,
          origin: "library",
          sourceKind: "bass",
          frozen: false,
        },
      },
    },
    sectionMinorAssignments: {},
    guitarCasmModes: {},
    auditionChannels: { bass: 11, drums: 9, guitar: 12, brass: 14 },
    voiceSelection: {
      bass: "x",
      drums: "y",
      guitar: "z",
      brass: "w",
    },
    partMixers: {},
    lastBuiltBytes: new Uint8Array([9, 9, 9]),
    lastBuiltFileName: "EasyPop.prs",
  }
}

describe("project-store", () => {
  it("sanitizes and requires project names", () => {
    expect(sanitizeProjectName("  My   Groove  ")).toBe("My Groove")
    expect(() => assertProjectName("   ")).toThrow(/required/i)
  })

  it("round-trips bytes through base64", () => {
    const bytes = new Uint8Array([0, 1, 255, 128, 7])
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes])
  })

  it("builds a write body from a workspace snapshot", () => {
    const body = writeBodyFromSnapshot("Funk Night", sampleSnapshot())
    expect(body.name).toBe("Funk Night")
    expect(body.donorFileName).toBe("EasyPop.prs")
    expect(body.payload.version).toBe(2)
    expect(
      body.payload.sectionAssignments["Main A"]?.[StyleMakerLane.Bass]?.title,
    ).toBe("Funk")
    expect(base64ToBytes(body.donorBytesBase64).length).toBe(5)
  })

  it("rejects oversized donor bytes", () => {
    const huge = sampleSnapshot()
    huge.donorBytes = new Uint8Array(STYLE_MAKER_PROJECT_MAX_BYTES + 1)
    expect(() => writeBodyFromSnapshot("Too Big", huge)).toThrow(/8 MB/i)
  })

  it("parses write bodies and rejects bad payloads", () => {
    const body = writeBodyFromSnapshot("Ok", sampleSnapshot())
    const parsed = parseWriteBody(body)
    expect(parsed.name).toBe("Ok")
    expect(() => parseWriteBody({ ...body, payload: { version: 1 } })).toThrow(
      /version/i,
    )
  })

  it("rebuilds a workspace snapshot from wire format", () => {
    const body = writeBodyFromSnapshot("Wire", sampleSnapshot())
    const snap = snapshotFromProjectWire({
      id: "abc",
      name: "Wire",
      donorFileName: body.donorFileName,
      donorBytesBase64: body.donorBytesBase64,
      lastBuiltFileName: body.lastBuiltFileName,
      lastBuiltBytesBase64: body.lastBuiltBytesBase64,
      payload: body.payload,
    })
    expect(snap.donorFileName).toBe("EasyPop.prs")
    expect([...snap.donorBytes]).toEqual([1, 2, 3, 4, 5])
    expect(snap.sectionAssignments["Main A"]?.[StyleMakerLane.Bass]?.title).toBe(
      "Funk",
    )
  })

  it("detects unique constraint violations", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true)
    expect(
      isUniqueViolation({
        message: 'duplicate key value violates unique constraint "style_maker_projects_user_name_idx"',
      }),
    ).toBe(true)
    expect(isUniqueViolation({ code: "42P01" })).toBe(false)
  })
})
