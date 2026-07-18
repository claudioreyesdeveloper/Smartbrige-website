import type { ProjectDocument, ProjectRecipe } from "@/lib/projects/document"
import {
  ProjectClientError,
  type ProjectSession,
  type ProjectSessionSnapshot,
} from "@/lib/projects/client"
import type {
  RhythmPart,
  RhythmProject,
  RhythmProjectAdapter,
  RhythmSection,
} from "./types"

const RECIPE_ENGINE_VERSION_MAX_LENGTH = 64

export type RhythmProjectReferenceUpdate = {
  part: RhythmPart
  recipeReferenceId: string
  renderReferenceId: string
  engineVersion: string
}

function hashContext(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function contextRevision(
  snapshot: ProjectSessionSnapshot,
  document: ProjectDocument,
  sectionId: string,
): string {
  return `project_${hashContext(JSON.stringify({
    revisionId: snapshot.revisionId,
    version: snapshot.version,
    schemaVersion: document.schemaVersion,
    song: document.song,
    sectionId,
  }))}`
}

function appliedSummary(document: ProjectDocument): string | null {
  if (document.bass && document.drums) return "Bass & drums saved"
  if (document.bass) return "Bass saved"
  if (document.drums) return "Drums saved"
  return null
}

function sectionFromDocument(
  snapshot: ProjectSessionSnapshot,
  document: ProjectDocument,
  section: ProjectDocument["song"]["sections"][number],
): RhythmSection {
  return {
    id: section.id,
    name: section.name,
    bars: section.bars ?? 0,
    chordContext: section.chords.length > 0
      ? section.chords.map((chord) => chord.symbol).join("  ·  ")
      : "No chords",
    contextRevision: contextRevision(snapshot, document, section.id),
  }
}

function projectFromSnapshot(snapshot: ProjectSessionSnapshot): RhythmProject {
  if (!snapshot.projectId || !snapshot.document) {
    throw new ProjectClientError("validation", "No project document is open.")
  }
  const document = snapshot.document
  return {
    id: snapshot.projectId,
    title: document.song.title,
    tempo: document.song.tempo,
    key: document.song.key,
    sections: document.song.sections.map((section) =>
      sectionFromDocument(snapshot, document, section)),
    appliedSummary: appliedSummary(document),
  }
}

async function openAndMap(session: ProjectSession, projectId: string): Promise<RhythmProject> {
  await session.open(projectId)
  const snapshot = session.getSnapshot()
  if (snapshot.projectId !== projectId) {
    throw new ProjectClientError("validation", "Project could not be opened.")
  }
  return projectFromSnapshot(snapshot)
}

export function createRhythmProjectAdapter(session: ProjectSession): RhythmProjectAdapter {
  return {
    async list() {
      const summaries = await session.list()
      const projects: RhythmProject[] = []
      for (const summary of summaries) {
        projects.push(await openAndMap(session, summary.id))
      }
      if (summaries.length > 1) {
        await session.open(summaries[0]!.id)
      }
      return projects
    },
    open(projectId) {
      return openAndMap(session, projectId)
    },
  }
}

function recipeFromReference(update: RhythmProjectReferenceUpdate): ProjectRecipe {
  if (
    update.recipeReferenceId.trim().length === 0 ||
    update.renderReferenceId.trim().length === 0 ||
    update.engineVersion.trim().length === 0
  ) {
    throw new ProjectClientError("validation", "Rhythm project references must be non-empty.")
  }
  if (update.engineVersion.length > RECIPE_ENGINE_VERSION_MAX_LENGTH) {
    throw new ProjectClientError("validation", "Rhythm engine version is too long.")
  }
  return {
    sourceId: update.recipeReferenceId,
    engineVersion: update.engineVersion,
    renderBlobId: update.renderReferenceId,
  }
}

export async function persistRhythmProjectReferences(
  session: ProjectSession,
  projectId: string,
  updates: readonly RhythmProjectReferenceUpdate[],
): Promise<RhythmProject> {
  if (session.getSnapshot().projectId !== projectId) {
    await session.open(projectId)
  }
  for (const update of updates) {
    const recipe = recipeFromReference(update)
    if (update.part === "bass") {
      session.setBass(recipe)
    } else {
      session.setDrums(recipe)
    }
  }

  const saved = await session.save()
  const snapshot = session.getSnapshot()
  if (!saved && snapshot.conflict) {
    throw new ProjectClientError("conflict", snapshot.conflict.message)
  }
  if (!saved && snapshot.saveState === "error") {
    throw new ProjectClientError("internal", snapshot.lastError ?? "Project references could not be saved.")
  }
  return projectFromSnapshot(snapshot)
}
