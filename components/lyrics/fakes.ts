import type {
  LyricsAdapters,
  LyricsProject,
  LyricAssignment,
  SavedLyrics,
} from "./types"

const verseNotes = [
  ["note-v1", "Note 1", "E4", "Beat 1", "1 beat"],
  ["note-v2", "Note 2", "G4", "Beat 2", "½ beat"],
  ["note-v3", "Note 3", "A4", "Beat 2½", "½ beat"],
  ["note-v4", "Note 4", "G4", "Beat 3", "1 beat"],
  ["note-v5", "Note 5", "E4", "Beat 5", "1 beat"],
  ["note-v6", "Note 6", "D4", "Beat 6", "1 beat"],
] as const

const chorusNotes = [
  ["note-c1", "Note 1", "A4", "Beat 1", "1 beat"],
  ["note-c2", "Note 2", "A4", "Beat 2", "1 beat"],
  ["note-c3", "Note 3", "G4", "Beat 3", "½ beat"],
  ["note-c4", "Note 4", "E4", "Beat 3½", "½ beat"],
  ["note-c5", "Note 5", "G4", "Beat 5", "1 beat"],
  ["note-c6", "Note 6", "A4", "Beat 6", "2 beats"],
] as const

function displayNotes(source: typeof verseNotes | typeof chorusNotes) {
  return source.map(([id, label, pitchLabel, beatLabel, durationLabel]) => ({
    id,
    label,
    pitchLabel,
    beatLabel,
    durationLabel,
  }))
}

function createProject(): LyricsProject {
  return {
    id: "project-coastal-drive",
    title: "Coastal Drive",
    tempo: 112,
    key: "C major",
    savedBySection: {},
    sections: [
      {
        id: "section-verse-1",
        name: "Verse 1",
        bars: 8,
        melodyLabel: "Lead vocal melody · Take 2",
        contextRevision: "melody_context_verse_1",
        notes: displayNotes(verseNotes),
      },
      {
        id: "section-chorus",
        name: "Chorus",
        bars: 8,
        melodyLabel: "Lead vocal melody · Chorus lift",
        contextRevision: "melody_context_chorus_1",
        notes: displayNotes(chorusNotes),
      },
    ],
  }
}

function generatedAssignments(noteIds: string[]): LyricAssignment[] {
  const words = [
    ["City", "Cit-y"],
    ["lights", "lights"],
    ["fade", "fade"],
    ["behind", "be-hind"],
    ["we", "we"],
    ["drive", "drive"],
  ]
  return words.map(([word, syllable], index) => ({
    id: `line-${index + 1}`,
    word: word!,
    syllable: syllable!,
    noteId: noteIds[index]!,
  }))
}

export function createDeterministicLyricsAdapters(): LyricsAdapters {
  let project = createProject()
  const wait = () => new Promise((resolve) => setTimeout(resolve, 25))
  const cloneProject = () => structuredClone(project)

  return {
    projects: {
      async list() {
        await wait()
        return [cloneProject()]
      },
      async open(projectId) {
        await wait()
        if (projectId !== project.id) throw new Error("Project could not be reopened.")
        return cloneProject()
      },
      async save(request) {
        await wait()
        const section = project.sections.find((item) => item.id === request.sectionId)
        if (!section || section.contextRevision !== request.contextRevision) {
          throw new Error("The melody section changed. Reopen it before saving.")
        }
        const saved: SavedLyrics = {
          creative: structuredClone(request.creative),
          assignments: structuredClone(request.assignments),
          recipeReferenceId: request.recipeReferenceId,
          renderReferenceId: request.renderReferenceId,
          exportReferenceId: request.exportReferenceId,
          savedLabel: `Lyrics saved for ${section.name}`,
        }
        project = {
          ...project,
          savedBySection: { ...project.savedBySection, [section.id]: saved },
        }
        return cloneProject()
      },
    },
    lyrics: {
      async generate(request) {
        await wait()
        return {
          assignments: generatedAssignments(request.notes.map((note) => note.id)),
          recipeReferenceId: `lyrics_recipe_${request.sectionId}`,
          statusLabel: `Lyrics generated for ${request.notes.length} melody notes`,
        }
      },
      async refit(request) {
        await wait()
        return {
          assignments: request.assignments.map((item, index) => ({
            ...item,
            noteId: request.notes[index % request.notes.length]!.id,
          })),
          recipeReferenceId: `lyrics_recipe_refit_${request.sectionId}`,
          statusLabel: "Edited lyrics re-fitted to the melody",
        }
      },
      async audition(input) {
        await wait()
        return {
          renderReferenceId: `lyrics_render_${input.sectionId}`,
          statusLabel: "Audition ready · melody with lyric guide",
        }
      },
      async export(input) {
        await wait()
        return {
          exportReferenceId: `lyrics_export_${input.sectionId}`,
          statusLabel: "Export prepared",
        }
      },
    },
  }
}
