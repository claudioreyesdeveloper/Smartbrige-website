import { describe, expect, it } from "vitest"
import { createDeterministicBassDrumsAdapters } from "@/components/bass-drums/fakes"
import {
  initialRhythmWorkspaceState,
  rhythmWorkspaceReducer,
  supportsRhythmWorkspace,
} from "@/components/bass-drums/state"

describe("Bass & Drums workspace state", () => {
  it("clears stale selections when the exact song section changes", () => {
    const selected = {
      ...initialRhythmWorkspaceState,
      projectId: "project-coastal-drive",
      sectionId: "section-verse-1",
      bassCandidateId: "opaque_bass_a",
      drumCandidateId: "opaque_drums_a",
      fillCandidateId: "opaque_fill_a",
      fillSlots: { 0: "opaque_fill_a" },
      loadingContext: false,
    }

    const next = rhythmWorkspaceReducer(selected, {
      type: "select-section",
      sectionId: "section-chorus",
    })

    expect(next).toMatchObject({
      sectionId: "section-chorus",
      bassCandidateId: null,
      drumCandidateId: null,
      fillCandidateId: null,
      fillSlots: {},
      suggestedDrums: false,
      loadingContext: true,
    })
  })

  it("only enables the Suggested drums transition after bass selection", () => {
    const blocked = rhythmWorkspaceReducer(initialRhythmWorkspaceState, {
      type: "show-suggested",
    })
    expect(blocked).toBe(initialRhythmWorkspaceState)

    const withBass = rhythmWorkspaceReducer(initialRhythmWorkspaceState, {
      type: "select-bass",
      candidateId: "opaque_bass_a",
    })
    const suggested = rhythmWorkspaceReducer(withBass, { type: "show-suggested" })
    expect(suggested).toMatchObject({
      activeTab: "drums",
      bassCandidateId: "opaque_bass_a",
      suggestedDrums: true,
      loadingContext: true,
    })
  })

  it("tracks audition play and Stop without exposing render ids in labels", () => {
    const playing = rhythmWorkspaceReducer(initialRhythmWorkspaceState, {
      type: "audition",
      state: {
        status: "playing",
        renderReferenceId: "render_bass_a",
        label: "Round Pocket 01",
        error: null,
      },
    })
    expect(playing.audition.label).toBe("Round Pocket 01")

    const stopped = rhythmWorkspaceReducer(playing, {
      type: "audition",
      state: {
        status: "stopped",
        renderReferenceId: null,
        label: null,
        error: null,
      },
    })
    expect(stopped.audition).toMatchObject({ status: "stopped", label: null })
  })

  it("assigns one selected fill independently to each four-bar slot", () => {
    const first = rhythmWorkspaceReducer(initialRhythmWorkspaceState, {
      type: "assign-fill",
      slot: 0,
      candidateId: "opaque_fill_a",
    })
    const second = rhythmWorkspaceReducer(first, {
      type: "assign-fill",
      slot: 1,
      candidateId: "opaque_fill_b",
    })
    expect(second.fillSlots).toEqual({
      0: "opaque_fill_a",
      1: "opaque_fill_b",
    })
  })

  it("returns only opaque recipe and render references after apply", async () => {
    const adapters = createDeterministicBassDrumsAdapters()
    const project = (await adapters.projects.list())[0]!
    const section = project.sections.find((item) => item.name === "Chorus")!

    const result = await adapters.library.applyToSong({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      bassCandidateId: "opaque_bass_b",
      drumCandidateId: "opaque_drums_b",
      fillCandidateIdsBySlot: { 0: "opaque_fill_a" },
    })

    expect(result.appliedReferences).toEqual([
      {
        part: "bass",
        recipeReferenceId: "recipe_ref_bass_section-chorus",
        renderReferenceId: "render_bass_b",
        statusLabel: "Bass saved for Chorus",
      },
      {
        part: "drums",
        recipeReferenceId: "recipe_ref_drums_section-chorus",
        renderReferenceId: "render_drums_b",
        statusLabel: "Drums saved for Chorus",
      },
    ])
    expect(result.project).not.toHaveProperty("document")
    const publicResponse = JSON.stringify(result)
    expect(publicResponse).not.toContain("opaque_bass_b")
    expect(publicResponse).not.toContain("opaque_drums_b")
    expect(publicResponse).not.toContain("opaque_fill_a")
    expect(publicResponse).not.toMatch(/"seed"|"settings"|"sourceId"|"recipe":/)
    expect(result.project.appliedSummary).toBe("Bass & drums applied to Chorus")
  })

  it("keeps candidate, fill, and audition references as opaque strings", async () => {
    const adapters = createDeterministicBassDrumsAdapters()
    const project = (await adapters.projects.list())[0]!
    const section = project.sections[0]!
    const candidates = await adapters.library.queryCandidates({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      part: "drums",
      filters: {
        genre: "All Genres",
        section: "All Sections",
        feel: "All Feels",
      },
    })
    const candidate = candidates.candidates[0]!
    const fills = await adapters.library.getFills({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      drumCandidateId: candidate.id,
    })
    const candidateRender = await adapters.library.prepareAudition({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      source: candidate.audition,
    })
    const fillRender = await adapters.library.prepareAudition({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      source: fills[0]!.audition,
    })

    expect(typeof candidate.id).toBe("string")
    expect(typeof candidateRender.renderReferenceId).toBe("string")
    expect(typeof fills[0]!.id).toBe("string")
    expect(typeof fillRender.renderReferenceId).toBe("string")
    expect(candidate).not.toHaveProperty("score")
    expect(candidate).not.toHaveProperty("seed")
    expect(fills[0]).not.toHaveProperty("sourcePath")
  })
})

describe("Bass & Drums compatibility boundary", () => {
  it("allows secure desktop Chrome and Edge", () => {
    expect(supportsRhythmWorkspace("Chrome/126.0.0.0", true)).toBe(true)
    expect(supportsRhythmWorkspace("Edg/126.0.0.0", true)).toBe(true)
  })

  it("stops phones, tablets, Safari, Firefox, and insecure contexts", () => {
    expect(supportsRhythmWorkspace("Chrome/126 Mobile", true)).toBe(false)
    expect(supportsRhythmWorkspace("iPad Chrome/126", true)).toBe(false)
    expect(supportsRhythmWorkspace("Version/18 Safari/605.1.15", true)).toBe(false)
    expect(supportsRhythmWorkspace("Firefox/128.0", true)).toBe(false)
    expect(supportsRhythmWorkspace("Chrome/126.0.0.0", false)).toBe(false)
  })
})
