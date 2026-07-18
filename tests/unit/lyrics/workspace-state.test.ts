import { describe, expect, it } from "vitest"
import { createDeterministicLyricsAdapters } from "@/components/lyrics/fakes"
import {
  initialLyricsWorkspaceState,
  lyricsWorkspaceReducer,
  supportsLyricsWorkspace,
} from "@/components/lyrics/state"

describe("Lyrics workspace state", () => {
  it("clears stale lyrics and opaque references when the melody section changes", () => {
    const populated = {
      ...initialLyricsWorkspaceState,
      projectId: "project-coastal-drive",
      sectionId: "section-verse-1",
      assignments: [{ id: "line-1", word: "City", syllable: "Cit-y", noteId: "note-v1" }],
      recipeReferenceId: "lyrics_recipe_verse",
      renderReferenceId: "lyrics_render_verse",
      exportReferenceId: "lyrics_export_verse",
      dirty: true,
      status: "editing" as const,
    }

    expect(
      lyricsWorkspaceReducer(populated, {
        type: "section",
        sectionId: "section-chorus",
      }),
    ).toMatchObject({
      sectionId: "section-chorus",
      assignments: [],
      recipeReferenceId: null,
      renderReferenceId: null,
      exportReferenceId: null,
      dirty: false,
      status: "ready",
    })
  })

  it("marks edits dirty and invalidates stale audition and export references", () => {
    const populated = {
      ...initialLyricsWorkspaceState,
      assignments: [{ id: "line-1", word: "City", syllable: "Cit-y", noteId: "note-v1" }],
      renderReferenceId: "lyrics_render_verse",
      exportReferenceId: "lyrics_export_verse",
    }
    const edited = lyricsWorkspaceReducer(populated, {
      type: "edit",
      assignmentId: "line-1",
      field: "word",
      value: "Street",
    })

    expect(edited.assignments[0]?.word).toBe("Street")
    expect(edited).toMatchObject({
      renderReferenceId: null,
      exportReferenceId: null,
      dirty: true,
      status: "editing",
    })
  })

  it("tracks re-fit, audition, export, and save as explicit stages", () => {
    const generated = lyricsWorkspaceReducer(initialLyricsWorkspaceState, {
      type: "generated",
      assignments: [{ id: "line-1", word: "City", syllable: "Cit-y", noteId: "note-v1" }],
      recipeReferenceId: "lyrics_recipe_verse",
    })
    const auditioned = lyricsWorkspaceReducer(generated, {
      type: "auditioned",
      renderReferenceId: "lyrics_render_verse",
    })
    const exported = lyricsWorkspaceReducer(auditioned, {
      type: "exported",
      exportReferenceId: "lyrics_export_verse",
    })
    const saved = lyricsWorkspaceReducer(exported, { type: "saved" })

    expect(saved).toMatchObject({
      recipeReferenceId: "lyrics_recipe_verse",
      renderReferenceId: "lyrics_render_verse",
      exportReferenceId: "lyrics_export_verse",
      dirty: false,
      status: "saved",
    })
  })
})

describe("Lyrics typed fake adapters", () => {
  it("generate and re-fit expose only editable lyrics, display notes, and opaque references", async () => {
    const adapters = createDeterministicLyricsAdapters()
    const project = (await adapters.projects.list())[0]!
    const section = project.sections[0]!
    const creative = {
      title: "Midnight Coast",
      about: "Leaving the city.",
      theme: "Freedom",
      mood: "Intimate",
      avoidWords: "forever",
    }
    const generated = await adapters.lyrics.generate({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      creative,
      notes: section.notes,
    })
    const fitted = await adapters.lyrics.refit({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      assignments: generated.assignments,
      notes: section.notes,
      recipeReferenceId: generated.recipeReferenceId,
    })

    const publicPayload = JSON.stringify({ project, generated, fitted })
    expect(publicPayload).not.toMatch(
      /prompt|cmudict|score|seed|trace|rawMidi|midiData|model|temperature/i,
    )
    expect(generated.recipeReferenceId).toMatch(/^lyrics_recipe_/)
    expect(fitted.assignments[0]).toEqual({
      id: "line-1",
      word: "City",
      syllable: "Cit-y",
      noteId: "note-v1",
    })
  })

  it("saves and reopens the edited assignment state", async () => {
    const adapters = createDeterministicLyricsAdapters()
    const project = (await adapters.projects.list())[0]!
    const section = project.sections[0]!
    const saved = await adapters.projects.save({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      creative: {
        title: "Midnight Coast",
        about: "Leaving the city.",
        theme: "Freedom",
        mood: "Intimate",
        avoidWords: "",
      },
      assignments: [{ id: "line-1", word: "Street", syllable: "Street", noteId: "note-v1" }],
      recipeReferenceId: "lyrics_recipe_refit_verse",
      renderReferenceId: "lyrics_render_verse",
      exportReferenceId: "lyrics_export_verse",
    })
    const reopened = await adapters.projects.open(project.id)

    expect(saved.savedBySection[section.id]?.savedLabel).toBe("Lyrics saved for Verse 1")
    expect(reopened.savedBySection[section.id]?.assignments[0]?.word).toBe("Street")
  })
})

describe("Lyrics compatibility boundary", () => {
  it("requires an injected adapter and a desktop viewport", () => {
    expect(supportsLyricsWorkspace("Chrome/126", 1440, true)).toBe(true)
    expect(supportsLyricsWorkspace("Chrome/126 Mobile", 1440, true)).toBe(false)
    expect(supportsLyricsWorkspace("Chrome/126", 900, true)).toBe(false)
    expect(supportsLyricsWorkspace("Chrome/126", 1440, false)).toBe(false)
  })
})
