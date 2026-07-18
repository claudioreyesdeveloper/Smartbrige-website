import { describe, expect, it, vi } from "vitest"
import {
  createRhythmProjectAdapter,
  persistRhythmProjectReferences,
} from "@/components/bass-drums/production"
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type ProjectDocument,
  type ProjectRecipe,
} from "@/lib/projects/document"
import {
  ProjectClientError,
  type ProjectSession,
  type ProjectSessionSnapshot,
} from "@/lib/projects/client"

function document(
  title: string,
  sections: ProjectDocument["song"]["sections"],
): ProjectDocument {
  return {
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    song: {
      title,
      tempo: 112,
      key: "D minor",
      sections,
    },
  }
}

function snapshot(
  projectId: string,
  revisionId: string,
  projectDocument: ProjectDocument,
): ProjectSessionSnapshot {
  return {
    phase: "ready",
    projects: [],
    projectId,
    title: projectDocument.song.title,
    revisionId,
    version: 3,
    document: projectDocument,
    dirty: false,
    saveState: "clean",
    lastError: null,
    conflict: null,
    migrationApplied: false,
    transportActive: false,
    pendingSaveAfterTransport: false,
  }
}

describe("production rhythm project adapter", () => {
  it("lists and opens projects with exact safe song section display data", async () => {
    const firstDocument = document("First", [{
      id: "section_intro",
      name: "Intro — exact",
      bars: 2.5,
      chords: [
        { symbol: "Dm9", startBeat: 0 },
        { symbol: "G13", startBeat: 4 },
      ],
    }])
    firstDocument.bass = {
      sourceId: "private-recipe-reference",
      engineVersion: "engine-public-1",
      settings: { hidden: true },
      seed: 42,
      chords: [{ symbol: "SECRET", startBeat: 0 }],
      renderBlobId: "private-render-reference",
    }
    const secondDocument = document("Second", [{
      id: "section_empty",
      name: "No harmony",
      bars: 7,
      chords: [],
    }])
    const snapshots = new Map([
      ["project_1", snapshot("project_1", "revision_1", firstDocument)],
      ["project_2", snapshot("project_2", "revision_2", secondDocument)],
    ])
    let current = snapshots.get("project_1")!
    const session = {
      getSnapshot: () => current,
      list: vi.fn(async () => [
        {
          id: "project_1",
          title: "First",
          currentRevisionId: "revision_1",
          currentVersion: 3,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-02",
        },
        {
          id: "project_2",
          title: "Second",
          currentRevisionId: "revision_2",
          currentVersion: 3,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-02",
        },
      ]),
      open: vi.fn(async (projectId: string) => {
        current = snapshots.get(projectId)!
      }),
    } as unknown as ProjectSession

    const adapter = createRhythmProjectAdapter(session)
    const projects = await adapter.list()

    expect(projects[0]).toMatchObject({
      id: "project_1",
      title: "First",
      tempo: 112,
      key: "D minor",
      appliedSummary: "Bass saved",
      sections: [{
        id: "section_intro",
        name: "Intro — exact",
        bars: 2.5,
        chordContext: "Dm9  ·  G13",
      }],
    })
    expect(JSON.stringify(projects)).not.toContain("private-recipe-reference")
    expect(JSON.stringify(projects)).not.toContain("private-render-reference")
    expect(JSON.stringify(projects)).not.toContain("SECRET")
    expect(session.open).toHaveBeenCalledTimes(3)

    await expect(adapter.open("project_2")).resolves.toMatchObject({
      id: "project_2",
      sections: [{
        id: "section_empty",
        name: "No harmony",
        bars: 7,
        chordContext: "No chords",
      }],
    })
  })

  it("changes deterministic context revisions with project revision or document context", async () => {
    let current = snapshot("project_1", "revision_1", document("Song", [{
      id: "verse",
      name: "Verse",
      bars: 4,
      chords: [{ symbol: "C", startBeat: 0 }],
    }]))
    const session = {
      getSnapshot: () => current,
      open: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
    } as unknown as ProjectSession
    const adapter = createRhythmProjectAdapter(session)

    const first = await adapter.open("project_1")
    const repeated = await adapter.open("project_1")
    expect(repeated.sections[0]!.contextRevision).toBe(first.sections[0]!.contextRevision)

    current = {
      ...current,
      revisionId: "revision_2",
      document: document("Song", [{
        id: "verse",
        name: "Verse",
        bars: 4,
        chords: [{ symbol: "F", startBeat: 0 }],
      }]),
    }
    const changed = await adapter.open("project_1")
    expect(changed.sections[0]!.contextRevision).not.toBe(first.sections[0]!.contextRevision)
  })

  it("persists only opaque recipe and render pointers through ProjectSession", async () => {
    let current = snapshot("project_1", "revision_1", document("Song", []))
    const setRecipe = (part: "bass" | "drums", recipe: ProjectRecipe) => {
      current = {
        ...current,
        dirty: true,
        saveState: "scheduled",
        document: { ...current.document!, [part]: recipe },
      }
    }
    const session = {
      getSnapshot: () => current,
      open: vi.fn(async () => undefined),
      setBass: vi.fn((recipe: ProjectRecipe) => setRecipe("bass", recipe)),
      setDrums: vi.fn((recipe: ProjectRecipe) => setRecipe("drums", recipe)),
      save: vi.fn(async () => {
        current = {
          ...current,
          revisionId: "revision_2",
          version: 4,
          dirty: false,
          saveState: "saved",
        }
        return true
      }),
    } as unknown as ProjectSession

    await persistRhythmProjectReferences(session, "project_1", [
      {
        part: "bass",
        recipeReferenceId: "opaque_bass_recipe",
        renderReferenceId: "opaque_bass_render",
        engineVersion: "bass-engine-3",
      },
      {
        part: "drums",
        recipeReferenceId: "opaque_drums_recipe",
        renderReferenceId: "opaque_drums_render",
        engineVersion: "drums-engine-2",
      },
    ])

    expect(current.document!.bass).toEqual({
      sourceId: "opaque_bass_recipe",
      engineVersion: "bass-engine-3",
      renderBlobId: "opaque_bass_render",
    })
    expect(current.document!.drums).toEqual({
      sourceId: "opaque_drums_recipe",
      engineVersion: "drums-engine-2",
      renderBlobId: "opaque_drums_render",
    })
    expect(session.save).toHaveBeenCalledOnce()
  })

  it("propagates open errors and save conflicts", async () => {
    const openError = new ProjectClientError("network", "Projects unavailable.")
    const failingSession = {
      list: vi.fn(async () => {
        throw openError
      }),
    } as unknown as ProjectSession
    await expect(createRhythmProjectAdapter(failingSession).list()).rejects.toBe(openError)

    let current = snapshot("project_1", "revision_1", document("Song", []))
    const conflictedSession = {
      getSnapshot: () => current,
      open: vi.fn(async () => undefined),
      setBass: vi.fn(() => {
        current = {
          ...current,
          dirty: true,
          saveState: "dirty",
        }
      }),
      save: vi.fn(async () => {
        current = {
          ...current,
          saveState: "conflict",
          conflict: {
            message: "Revision conflict.",
            localTitle: "Song",
            localDocument: current.document!,
          },
        }
        return false
      }),
    } as unknown as ProjectSession

    await expect(
      persistRhythmProjectReferences(conflictedSession, "project_1", [{
        part: "bass",
        recipeReferenceId: "opaque_recipe",
        renderReferenceId: "opaque_render",
        engineVersion: "engine-1",
      }]),
    ).rejects.toMatchObject({ code: "conflict", message: "Revision conflict." })
  })
})
