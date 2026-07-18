import type {
  PreparedSoloAudition,
  SoloOption,
  SoloOptionCatalog,
  SoloPhrasesAdapters,
  SoloPlaybackState,
  SoloProject,
  SoloSelections,
  SoloTakeSummary,
} from "./types"

const OPTIONS: SoloOptionCatalog = {
  instruments: [
    { id: "instrument_01", label: "Tenor Sax" },
    { id: "instrument_02", label: "Trumpet" },
    { id: "instrument_03", label: "Electric Guitar" },
    { id: "instrument_04", label: "Flugelhorn" },
  ],
  styles: [
    { id: "style_01", label: "Pop & Rock" },
    { id: "style_02", label: "Jazz & Big Band" },
    { id: "style_03", label: "Soul & Motown" },
    { id: "style_04", label: "Funk & Horns" },
  ],
  lineFeels: [
    { id: "line_01", label: "Safe" },
    { id: "line_02", label: "Balanced" },
    { id: "line_03", label: "Expressive" },
  ],
  grooves: [
    { id: "groove_01", label: "Auto (from style)" },
    { id: "groove_02", label: "Straight" },
    { id: "groove_03", label: "Swing" },
  ],
  voicings: [
    { id: "voicing_01", label: "Match Setup" },
    { id: "voicing_02", label: "Force mono" },
    { id: "voicing_03", label: "Force poly" },
  ],
}

const TAKE_DESCRIPTIONS = [
  "A clear opening statement with relaxed space between ideas.",
  "A melodic lift that grows naturally into the section change.",
  "A more active line with a confident, modern contour.",
  "A restrained alternative with a clean resolved ending.",
]

function makeProjects(): SoloProject[] {
  return [
    {
      id: "project_01",
      title: "Coastal Drive",
      tempoLabel: "112 bpm",
      keyLabel: "C major",
      savedTakeBySection: {},
      sections: [
        {
          id: "section_01",
          name: "Verse 1",
          bars: 8,
          chordContextLabel: "Cmaj7  ·  Am7  ·  Fmaj7  ·  G7",
          contextRevision: "context_01",
        },
        {
          id: "section_02",
          name: "Chorus",
          bars: 8,
          chordContextLabel: "Fmaj7  ·  G7  ·  Em7  ·  Am7",
          contextRevision: "context_02",
        },
      ],
    },
    {
      id: "project_02",
      title: "Midnight Signals",
      tempoLabel: "96 bpm",
      keyLabel: "D minor",
      savedTakeBySection: {},
      sections: [
        {
          id: "section_03",
          name: "Bridge",
          bars: 4,
          chordContextLabel: "Dm9  ·  Bbmaj7  ·  Gm7  ·  A7",
          contextRevision: "context_03",
        },
      ],
    },
  ]
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function optionLabel(options: SoloOption[], id: string): string {
  return options.find((option) => option.id === id)?.label ?? "Auto"
}

function makeTake(
  index: number,
  generation: number,
  selections: SoloSelections,
  durationLabel: string,
): SoloTakeSummary {
  return {
    takeId: `take_${generation}_${index + 1}`,
    label: `Take ${index + 1}`,
    description: TAKE_DESCRIPTIONS[index % TAKE_DESCRIPTIONS.length]!,
    durationLabel,
    instrumentLabel: optionLabel(OPTIONS.instruments, selections.instrumentId),
    styleLabel: optionLabel(OPTIONS.styles, selections.styleId),
    lineFeelLabel: optionLabel(OPTIONS.lineFeels, selections.lineFeelId),
    grooveLabel: optionLabel(OPTIONS.grooves, selections.grooveId),
    playbackStatus: "ready",
  }
}

/** Test-only deterministic adapters. Production code must inject a real boundary. */
export function createDeterministicSoloPhrasesAdapters(): SoloPhrasesAdapters {
  let projects = makeProjects()
  let generation = 0
  let playback: SoloPlaybackState = {
    status: "idle",
    takeId: null,
    label: null,
    statusLabel: "Ready",
  }
  const listeners = new Set<(state: SoloPlaybackState) => void>()
  const wait = () => new Promise((resolve) => setTimeout(resolve, 25))
  const emit = () => {
    for (const listener of listeners) listener(clone(playback))
  }

  return {
    projects: {
      async list() {
        await wait()
        return clone(projects)
      },
      async open(projectId) {
        await wait()
        const project = projects.find((item) => item.id === projectId)
        if (!project) throw new Error("Project could not be opened.")
        return clone(project)
      },
    },
    generator: {
      async getOptions() {
        await wait()
        return clone(OPTIONS)
      },
      async generateTakes(request) {
        await wait()
        const project = projects.find((item) => item.id === request.projectId)
        const section = project?.sections.find((item) => item.id === request.sectionId)
        if (!section || section.contextRevision !== request.contextRevision) {
          throw new Error("Section context changed. Reopen the project and try again.")
        }
        generation += 1
        const takeCount = Math.max(2, Math.min(6, request.takeCount))
        return {
          takes: Array.from({ length: takeCount }, (_, index) =>
            makeTake(
              index,
              generation,
              request.selections,
              `${section.bars} bars`,
            ),
          ),
          contextStatusLabel: `${takeCount} takes ready for ${section.name}`,
        }
      },
      async prepareAudition(input) {
        await wait()
        const project = projects.find((item) => item.id === input.projectId)
        const section = project?.sections.find((item) => item.id === input.sectionId)
        if (!section || section.contextRevision !== input.contextRevision) {
          throw new Error("This audition is no longer current.")
        }
        return {
          takeId: input.takeId,
          renderReferenceId: `render_${input.takeId}`,
          recipeReferenceId: `recipe_${input.takeId}`,
          durationLabel: `${section.bars} bars`,
          playbackStatusLabel: "Ready to audition",
        }
      },
      async saveTake(request) {
        await wait()
        const projectIndex = projects.findIndex((item) => item.id === request.projectId)
        const section = projects[projectIndex]?.sections.find(
          (item) => item.id === request.sectionId,
        )
        if (
          projectIndex < 0 ||
          !section ||
          section.contextRevision !== request.contextRevision
        ) {
          throw new Error("Section context changed. Reopen the project and try again.")
        }
        if (request.take.takeId !== request.audition.takeId) {
          throw new Error("Prepare the selected take before saving.")
        }
        const savedTake = {
          takeId: request.take.takeId,
          renderReferenceId: request.audition.renderReferenceId,
          recipeReferenceId: request.audition.recipeReferenceId,
          label: request.take.label,
          durationLabel: request.take.durationLabel,
          instrumentLabel: request.take.instrumentLabel,
          styleLabel: request.take.styleLabel,
          statusLabel: `Selected for ${section.name}`,
        }
        projects = projects.map((project, index) =>
          index === projectIndex
            ? {
                ...project,
                savedTakeBySection: {
                  ...project.savedTakeBySection,
                  [section.id]: savedTake,
                },
              }
            : project,
        )
        return {
          project: clone(projects[projectIndex]!),
          savedTake: clone(savedTake),
          message: `${request.take.label} saved for ${section.name}`,
        }
      },
    },
    audition: {
      getState: () => clone(playback),
      async start(audition: PreparedSoloAudition, label: string) {
        await wait()
        playback = {
          status: "playing",
          takeId: audition.takeId,
          label,
          statusLabel: `Playing ${label}`,
        }
        emit()
      },
      stop() {
        playback = {
          status: "stopped",
          takeId: null,
          label: null,
          statusLabel: "Audition stopped",
        }
        emit()
      },
      subscribe(listener) {
        listeners.add(listener)
        listener(clone(playback))
        return () => listeners.delete(listener)
      },
    },
  }
}
