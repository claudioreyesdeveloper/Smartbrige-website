import { describe, expect, it } from "vitest"
import {
  PROJECT_DOCUMENT_MAX_BYTES,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  createEmptyProjectDocument,
  measureDocumentBytes,
  migrateProjectDocument,
  parseAndValidateProjectDocument,
} from "@/lib/projects"
import { ProjectError } from "@/lib/projects/errors"

describe("project document schema", () => {
  it("creates a valid empty versioned document", () => {
    const document = createEmptyProjectDocument("Demo Song")
    expect(document.schemaVersion).toBe(PROJECT_DOCUMENT_SCHEMA_VERSION)
    expect(document.song.title).toBe("Demo Song")
    expect(document.song.tempo).toBe(120)
    expect(document.song.key).toBe("C")
    expect(document.song.sections).toEqual([])
  })

  it("validates a full musical document with optional recipe fields", () => {
    const document = parseAndValidateProjectDocument({
      schemaVersion: 1,
      song: {
        title: "Night Drive",
        tempo: 96,
        key: "Am",
        style: { id: "style-1", name: "Cool Ballad" },
        sections: [
          {
            id: "sec-a",
            name: "Verse",
            stylePart: "mainA",
            bars: 8,
            chords: [{ symbol: "Am7", startBeat: 0, durationBeats: 4 }],
          },
        ],
      },
      bass: {
        sourceId: "bass-clip-1",
        engineVersion: "1.0.0",
        seed: 42,
        tempo: 96,
        renderBlobId: "blob-bass",
      },
      drums: {
        sourceId: "drum-clip-1",
        engineVersion: "1.0.0",
      },
      solos: [
        {
          id: "solo-1",
          instrument: "sax",
          selected: true,
          recipe: { sourceId: "solo-engine", engineVersion: "1.0.0", seed: 7 },
        },
      ],
      lyrics: { text: "hello world", syllables: [{ text: "hel", noteIndex: 0, tick: 0 }] },
      mixer: { channels: [{ part: 1, volume: 100, mute: false }] },
      blobs: [{ blobReferenceId: "blob-1", purpose: "render", label: "section-a" }],
      jam: {
        factorySongStableId: "factory_song:night-drive",
        styleStableId: "style:genos:42",
        model: "genos",
        loop: true,
        generationId: "gen_1",
        candidateId: "cand_1",
        selectedChordsBySection: {
          "sec-a": [{ symbol: "Am9", startBeat: 0, durationBeats: 4 }],
        },
      },
    })

    expect(document.song.sections).toHaveLength(1)
    expect(document.bass?.sourceId).toBe("bass-clip-1")
    expect(document.solos?.[0]?.selected).toBe(true)
    expect(document.blobs?.[0]?.purpose).toBe("render")
    expect(document.jam).toMatchObject({
      factorySongStableId: "factory_song:night-drive",
      styleStableId: "style:genos:42",
      model: "genos",
      loop: true,
      candidateId: "cand_1",
    })
  })

  it("migrates older unversioned / flat project documents", () => {
    const migrated = migrateProjectDocument({
      version: 0,
      title: "Legacy Tune",
      tempo: 110,
      key: "G",
      sections: [{ id: "s1", name: "A", chords: [{ symbol: "G", startBeat: 0 }] }],
      drums: { sourceId: "old-drum", engineVersion: "0.9.0" },
    })

    expect(migrated.schemaVersion).toBe(1)
    expect(migrated.song.title).toBe("Legacy Tune")
    expect(migrated.song.tempo).toBe(110)
    expect(migrated.song.sections[0]?.name).toBe("A")
    expect(migrated.drums?.sourceId).toBe("old-drum")
  })

  it("rejects malformed documents", () => {
    expect(() => parseAndValidateProjectDocument({ schemaVersion: 1 })).toThrow(ProjectError)
    expect(() =>
      parseAndValidateProjectDocument({
        schemaVersion: 1,
        song: { title: "x", tempo: -1, key: "C", sections: [] },
      }),
    ).toThrow(/tempo/)
    expect(() =>
      parseAndValidateProjectDocument({
        schemaVersion: 1,
        song: {
          title: "x",
          tempo: 120,
          key: "C",
          sections: [{ id: "s", name: "A", stylePart: "not-a-part", chords: [] }],
        },
      }),
    ).toThrow(/style part/)
    expect(() =>
      parseAndValidateProjectDocument({
        schemaVersion: 1,
        song: { title: "x", tempo: 120, key: "C", sections: [] },
        jam: {
          factorySongStableId: "factory_song:x",
          styleStableId: "style:x",
          model: "unsupported",
          loop: false,
        },
      }),
    ).toThrow(/supported Yamaha model/)
  })

  it("rejects oversized payloads", () => {
    const hugeTitle = "A".repeat(PROJECT_DOCUMENT_MAX_BYTES)
    expect(() =>
      parseAndValidateProjectDocument({
        schemaVersion: 1,
        song: { title: hugeTitle, tempo: 120, key: "C", sections: [] },
      }),
    ).toThrow(ProjectError)

    try {
      parseAndValidateProjectDocument({
        schemaVersion: 1,
        song: { title: hugeTitle, tempo: 120, key: "C", sections: [] },
      })
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectError)
      expect((error as ProjectError).code).toBe("payload_too_large")
    }
  })

  it("measures document byte size deterministically", () => {
    const document = createEmptyProjectDocument("Size Check")
    expect(measureDocumentBytes(document)).toBeGreaterThan(20)
  })
})
