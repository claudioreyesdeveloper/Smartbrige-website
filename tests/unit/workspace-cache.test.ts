import { describe, expect, it } from "vitest"
import { StyleMakerLane } from "@/lib/style-maker/lanes"
import {
  draftStorageKey,
  normalizeWorkspaceSnapshot,
} from "@/lib/style-maker/workspace-cache"

describe("normalizeWorkspaceSnapshot", () => {
  it("migrates v1 global assignments into the active section", () => {
    const normalized = normalizeWorkspaceSnapshot({
      version: 1,
      savedAt: 1,
      donorFileName: "Demo.prs",
      donorBytes: new Uint8Array([1, 2, 3]),
      sectionName: "Main B",
      bars: 2,
      includeCC: true,
      selectedLane: StyleMakerLane.Bass,
      libTab: "bass",
      sectionAssignments: {},
      assignments: {
        [StyleMakerLane.Bass]: {
          title: "Funk Bass",
          subtitle: "library",
          notes: [],
          cycleTicks: 384,
          origin: "library",
          sourceKind: "bass",
          frozen: false,
        },
      },
      guitarCasmModes: {},
      auditionChannels: { bass: 11, drums: 9, guitar: 12, brass: 14 },
      voiceSelection: {
        bass: "x",
        drums: "y",
        guitar: "z",
        brass: "w",
      },
    })

    expect(normalized?.version).toBe(2)
    expect(normalized?.sectionAssignments["Main B"]?.[StyleMakerLane.Bass]?.title).toBe(
      "Funk Bass",
    )
    expect(normalized?.assignments?.[StyleMakerLane.Bass]?.title).toBe("Funk Bass")
  })

  it("keys local drafts by user and project", () => {
    expect(draftStorageKey({ userId: "user_1", projectId: null })).toBe(
      "draft:user_1:unsaved",
    )
    expect(draftStorageKey({ userId: "user_1", projectId: "abc" })).toBe(
      "draft:user_1:abc",
    )
  })
})
