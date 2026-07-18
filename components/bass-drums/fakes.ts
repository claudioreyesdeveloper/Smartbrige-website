import type {
  AppliedRhythmReference,
  AuditionState,
  BassDrumsAdapters,
  OpaqueAuditionRender,
  RhythmCandidateSummary,
  RhythmFillSummary,
  RhythmPart,
  RhythmProject,
} from "./types"

const BASS_CANDIDATES: RhythmCandidateSummary[] = [
  {
    id: "opaque_bass_a",
    name: "Round Pocket 01",
    genre: "Pop",
    section: "Verse",
    feel: "Straight 8ths",
    bars: 4,
    summary: "Warm, even movement with space around the backbeat.",
    audition: { renderReferenceId: "render_bass_a", durationLabel: "4 bars" },
  },
  {
    id: "opaque_bass_b",
    name: "Melodic Lift 02",
    genre: "Pop",
    section: "Chorus",
    feel: "Straight 8ths",
    bars: 4,
    summary: "A more active phrase shaped for a chorus lift.",
    audition: { renderReferenceId: "render_bass_b", durationLabel: "4 bars" },
  },
  {
    id: "opaque_bass_c",
    name: "Deep Syncopation 03",
    genre: "Funk",
    section: "Verse",
    feel: "16ths",
    bars: 4,
    summary: "Short syncopated notes with a grounded low register.",
    audition: { renderReferenceId: "render_bass_c", durationLabel: "4 bars" },
  },
  {
    id: "opaque_bass_d",
    name: "Laid Back 04",
    genre: "Soul",
    section: "Bridge",
    feel: "Swing",
    bars: 4,
    summary: "Relaxed movement for a softer change in energy.",
    audition: { renderReferenceId: "render_bass_d", durationLabel: "4 bars" },
  },
]

const DRUM_CANDIDATES: RhythmCandidateSummary[] = [
  {
    id: "opaque_drums_a",
    name: "Studio Pocket 01",
    genre: "Pop",
    section: "Verse",
    feel: "Straight 8ths",
    bars: 4,
    summary: "Tight kick and snare with a restrained closed-hat pattern.",
    audition: { renderReferenceId: "render_drums_a", durationLabel: "4 bars" },
  },
  {
    id: "opaque_drums_b",
    name: "Open Chorus 02",
    genre: "Pop",
    section: "Chorus",
    feel: "Straight 8ths",
    bars: 4,
    summary: "Open hats and a wider backbeat for a chorus section.",
    audition: { renderReferenceId: "render_drums_b", durationLabel: "4 bars" },
  },
  {
    id: "opaque_drums_c",
    name: "Dry Funk 03",
    genre: "Funk",
    section: "Verse",
    feel: "16ths",
    bars: 4,
    summary: "Dry kit, ghost-note detail, and a concise syncopated kick.",
    audition: { renderReferenceId: "render_drums_c", durationLabel: "4 bars" },
  },
]

const FILLS: RhythmFillSummary[] = [
  {
    id: "opaque_fill_a",
    name: "Compact Turn",
    feel: "Straight 8ths",
    lengthLabel: "1 bar",
    audition: { renderReferenceId: "render_fill_a", durationLabel: "1 bar" },
  },
  {
    id: "opaque_fill_b",
    name: "Snare Lift",
    feel: "Straight 8ths",
    lengthLabel: "1 bar",
    audition: { renderReferenceId: "render_fill_b", durationLabel: "1 bar" },
  },
  {
    id: "opaque_fill_c",
    name: "Short Tom Run",
    feel: "16ths",
    lengthLabel: "1 bar",
    audition: { renderReferenceId: "render_fill_c", durationLabel: "1 bar" },
  },
]

function createProject(): RhythmProject {
  return {
    id: "project-coastal-drive",
    title: "Coastal Drive Arrangement",
    tempo: 112,
    key: "C",
    appliedSummary: null,
    sections: [
      {
        id: "section-verse-1",
        name: "Verse 1",
        bars: 8,
        chordContext: "Cmaj7  ·  Am7  ·  Fmaj7  ·  G7",
        contextRevision: "context_1",
      },
      {
        id: "section-pre-chorus",
        name: "Pre-Chorus",
        bars: 4,
        chordContext: "Dm7  ·  G7",
        contextRevision: "context_2",
      },
      {
        id: "section-chorus",
        name: "Chorus",
        bars: 8,
        chordContext: "Fmaj7  ·  G7  ·  Em7  ·  Am7",
        contextRevision: "context_3",
      },
    ],
  }
}

function cloneProject(project: RhythmProject): RhythmProject {
  return structuredClone(project)
}

function candidateFor(part: RhythmPart, id: string | null) {
  return (part === "bass" ? BASS_CANDIDATES : DRUM_CANDIDATES).find(
    (candidate) => candidate.id === id,
  )
}

function renderFor(part: RhythmPart, id: string): string {
  return candidateFor(part, id)?.audition.renderReferenceId ?? `render_${part}_applied`
}

export function createDeterministicBassDrumsAdapters(): BassDrumsAdapters {
  let currentProject = createProject()
  let auditionState: AuditionState = {
    status: "idle",
    renderReferenceId: null,
    label: null,
    error: null,
  }
  const auditionListeners = new Set<(state: AuditionState) => void>()
  const emitAudition = () => {
    for (const listener of auditionListeners) listener({ ...auditionState })
  }
  const wait = () => new Promise((resolve) => setTimeout(resolve, 35))

  return {
    projects: {
      async list() {
        await wait()
        return [cloneProject(currentProject)]
      },
      async open(projectId) {
        await wait()
        if (projectId !== currentProject.id) throw new Error("Project could not be opened.")
        return cloneProject(currentProject)
      },
    },
    library: {
      async getFilterOptions(part) {
        await wait()
        const candidates = part === "bass" ? BASS_CANDIDATES : DRUM_CANDIDATES
        return {
          genres: ["All Genres", ...new Set(candidates.map((item) => item.genre))],
          sections: ["All Sections", ...new Set(candidates.map((item) => item.section))],
          feels: ["All Feels", ...new Set(candidates.map((item) => item.feel))],
        }
      },
      async queryCandidates(query) {
        await wait()
        const source = query.part === "bass" ? BASS_CANDIDATES : DRUM_CANDIDATES
        const candidates = source.filter(
          (item) =>
            (query.filters.genre === "All Genres" ||
              item.genre === query.filters.genre) &&
            (query.filters.section === "All Sections" ||
              item.section === query.filters.section) &&
            (query.filters.feel === "All Feels" || item.feel === query.filters.feel),
        )
        const section = currentProject.sections.find((item) => item.id === query.sectionId)
        return {
          candidates: structuredClone(candidates),
          total: candidates.length,
          contextLabel: `Updated for ${section?.name ?? "section"} chord context`,
        }
      },
      async getSuggestedDrums(query) {
        await wait()
        if (!candidateFor("bass", query.bassCandidateId)) {
          throw new Error("Select a bass phrase before requesting Suggested drums.")
        }
        const section = currentProject.sections.find((item) => item.id === query.sectionId)
        return {
          candidates: structuredClone([DRUM_CANDIDATES[1]!, DRUM_CANDIDATES[0]!]),
          total: 2,
          contextLabel: `Suggested drums for ${section?.name ?? "section"}`,
        }
      },
      async getFills() {
        await wait()
        return structuredClone(FILLS)
      },
      async applyToSong(request) {
        await wait()
        const section = currentProject.sections.find((item) => item.id === request.sectionId)
        if (!section || section.contextRevision !== request.contextRevision) {
          throw new Error("Chord context changed. Refresh candidates and try again.")
        }
        if (!request.bassCandidateId && !request.drumCandidateId) {
          throw new Error("Select a bass phrase or drum groove before applying.")
        }

        const appliedReferences: AppliedRhythmReference[] = []
        const addReference = (part: RhythmPart, candidateId: string) => {
          const renderReferenceId = renderFor(part, candidateId)
          appliedReferences.push({
            part,
            recipeReferenceId: `recipe_ref_${part}_${section.id}`,
            renderReferenceId,
            statusLabel: `${part === "bass" ? "Bass" : "Drums"} saved for ${section.name}`,
          })
        }
        if (request.bassCandidateId) addReference("bass", request.bassCandidateId)
        if (request.drumCandidateId) addReference("drums", request.drumCandidateId)

        const parts = [
          request.bassCandidateId ? "bass" : "",
          request.drumCandidateId ? "drums" : "",
        ].filter(Boolean)
        const appliedSummary = `${
          parts.length === 2 ? "Bass & drums" : parts[0] === "bass" ? "Bass" : "Drums"
        } applied to ${section.name}`
        currentProject = { ...currentProject, appliedSummary }
        return {
          project: cloneProject(currentProject),
          appliedReferences: structuredClone(appliedReferences),
          message: `${appliedSummary}. Project recipes and render references are saved.`,
        }
      },
    },
    audition: {
      getState: () => ({ ...auditionState }),
      async play(render: OpaqueAuditionRender, label: string) {
        await wait()
        auditionState = {
          status: "playing",
          renderReferenceId: render.renderReferenceId,
          label,
          error: null,
        }
        emitAudition()
      },
      stop() {
        auditionState = {
          status: "stopped",
          renderReferenceId: null,
          label: null,
          error: null,
        }
        emitAudition()
      },
      subscribe(listener) {
        auditionListeners.add(listener)
        listener({ ...auditionState })
        return () => auditionListeners.delete(listener)
      },
    },
  }
}
