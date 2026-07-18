import { describe, expect, it } from "vitest"
import { createDeterministicSoloPhrasesAdapters } from "@/components/solo-phrases/fakes"
import {
  initialSoloWorkspaceState,
  soloWorkspaceReducer,
  supportsSoloWorkspace,
} from "@/components/solo-phrases/state"

describe("Solo Phrases workspace state", () => {
  it("clears generated and audition state when the section changes", () => {
    const populated = {
      ...initialSoloWorkspaceState,
      projectId: "project_01",
      sectionId: "section_01",
      takes: [{
        takeId: "take_1",
        label: "Take 1",
        description: "Display-safe summary",
        durationLabel: "8 bars",
        instrumentLabel: "Tenor Sax",
        styleLabel: "Pop & Rock",
        lineFeelLabel: "Balanced",
        grooveLabel: "Straight",
        playbackStatus: "ready" as const,
      }],
      selectedTakeId: "take_1",
      preparedAudition: {
        takeId: "take_1",
        renderReferenceId: "render_1",
        recipeReferenceId: "recipe_1",
        durationLabel: "8 bars",
        playbackStatusLabel: "Ready to audition",
      },
    }

    const next = soloWorkspaceReducer(populated, {
      type: "select-section",
      sectionId: "section_02",
      savedTake: null,
    })

    expect(next).toMatchObject({
      sectionId: "section_02",
      takes: [],
      selectedTakeId: null,
      preparedAudition: null,
      savedTake: null,
    })
  })

  it("selects the first result after generating several takes", () => {
    const takes = [
      {
        takeId: "take_1",
        label: "Take 1",
        description: "First",
        durationLabel: "8 bars",
        instrumentLabel: "Tenor Sax",
        styleLabel: "Pop & Rock",
        lineFeelLabel: "Balanced",
        grooveLabel: "Straight",
        playbackStatus: "ready" as const,
      },
      {
        takeId: "take_2",
        label: "Take 2",
        description: "Second",
        durationLabel: "8 bars",
        instrumentLabel: "Tenor Sax",
        styleLabel: "Pop & Rock",
        lineFeelLabel: "Balanced",
        grooveLabel: "Straight",
        playbackStatus: "ready" as const,
      },
    ]
    const next = soloWorkspaceReducer(
      { ...initialSoloWorkspaceState, generating: true },
      { type: "generation-completed", takes },
    )
    expect(next.takes).toHaveLength(2)
    expect(next.selectedTakeId).toBe("take_1")
    expect(next.generating).toBe(false)
  })

  it("tracks Start and Stop using only display-safe playback state", () => {
    const playing = soloWorkspaceReducer(initialSoloWorkspaceState, {
      type: "playback",
      playback: {
        status: "playing",
        takeId: "take_1",
        label: "Take 1",
        statusLabel: "Playing Take 1",
      },
    })
    expect(playing.playback).toEqual({
      status: "playing",
      takeId: "take_1",
      label: "Take 1",
      statusLabel: "Playing Take 1",
    })

    const stopped = soloWorkspaceReducer(playing, {
      type: "playback",
      playback: {
        status: "stopped",
        takeId: null,
        label: null,
        statusLabel: "Audition stopped",
      },
    })
    expect(stopped.playback.status).toBe("stopped")
  })

  it("saves one take and restores it after reopening the project", async () => {
    const adapters = createDeterministicSoloPhrasesAdapters()
    const project = (await adapters.projects.list())[0]!
    const section = project.sections[0]!
    const options = await adapters.generator.getOptions(project.id)
    const generated = await adapters.generator.generateTakes({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      takeCount: 4,
      selections: {
        instrumentId: options.instruments[0]!.id,
        styleId: options.styles[0]!.id,
        lineFeelId: options.lineFeels[1]!.id,
        grooveId: options.grooves[0]!.id,
        voicingId: options.voicings[0]!.id,
      },
    })
    const take = generated.takes[1]!
    const audition = await adapters.generator.prepareAudition({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      takeId: take.takeId,
    })
    await adapters.generator.saveTake({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      take,
      audition,
    })

    const reopened = await adapters.projects.open(project.id)
    expect(reopened.savedTakeBySection[section.id]).toMatchObject({
      takeId: take.takeId,
      label: "Take 2",
      renderReferenceId: audition.renderReferenceId,
      recipeReferenceId: audition.recipeReferenceId,
    })
  })

  it("exposes opaque references and no private generation metadata", async () => {
    const adapters = createDeterministicSoloPhrasesAdapters()
    const project = (await adapters.projects.list())[0]!
    const section = project.sections[0]!
    const options = await adapters.generator.getOptions(project.id)
    const generated = await adapters.generator.generateTakes({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      takeCount: 4,
      selections: {
        instrumentId: options.instruments[0]!.id,
        styleId: options.styles[0]!.id,
        lineFeelId: options.lineFeels[0]!.id,
        grooveId: options.grooves[0]!.id,
        voicingId: options.voicings[0]!.id,
      },
    })
    const audition = await adapters.generator.prepareAudition({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      takeId: generated.takes[0]!.takeId,
    })
    const publicShape = JSON.stringify({ generated, audition })

    expect(typeof generated.takes[0]!.takeId).toBe("string")
    expect(typeof audition.renderReferenceId).toBe("string")
    expect(typeof audition.recipeReferenceId).toBe("string")
    expect(publicShape).not.toMatch(/phraseId|source|score|seed|steps|algorithm/i)
  })
})

describe("Solo Phrases compatibility boundary", () => {
  it("allows secure desktop Chrome and Edge", () => {
    expect(supportsSoloWorkspace("Chrome/126.0.0.0", true)).toBe(true)
    expect(supportsSoloWorkspace("Edg/126.0.0.0", true)).toBe(true)
  })

  it("stops unsupported and insecure clients", () => {
    expect(supportsSoloWorkspace("Chrome/126 Mobile", true)).toBe(false)
    expect(supportsSoloWorkspace("iPad Chrome/126", true)).toBe(false)
    expect(supportsSoloWorkspace("Version/18 Safari/605.1.15", true)).toBe(false)
    expect(supportsSoloWorkspace("Firefox/128.0", true)).toBe(false)
    expect(supportsSoloWorkspace("Chrome/126.0.0.0", false)).toBe(false)
  })
})
