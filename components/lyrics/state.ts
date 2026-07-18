import type { LyricAssignment } from "./types"

export type LyricsWorkspaceState = {
  projectId: string | null
  sectionId: string | null
  assignments: LyricAssignment[]
  recipeReferenceId: string | null
  renderReferenceId: string | null
  exportReferenceId: string | null
  dirty: boolean
  status: "ready" | "generating" | "editing" | "fitting" | "auditioned" | "exported" | "saved"
}

export const initialLyricsWorkspaceState: LyricsWorkspaceState = {
  projectId: null,
  sectionId: null,
  assignments: [],
  recipeReferenceId: null,
  renderReferenceId: null,
  exportReferenceId: null,
  dirty: false,
  status: "ready",
}

export type LyricsWorkspaceAction =
  | { type: "select"; projectId: string; sectionId: string | null }
  | { type: "section"; sectionId: string }
  | { type: "generating" }
  | { type: "generated"; assignments: LyricAssignment[]; recipeReferenceId: string }
  | { type: "edit"; assignmentId: string; field: "word" | "syllable"; value: string }
  | { type: "fitting" }
  | { type: "fitted"; assignments: LyricAssignment[]; recipeReferenceId: string }
  | { type: "auditioned"; renderReferenceId: string }
  | { type: "exported"; exportReferenceId: string }
  | { type: "reopen"; assignments: LyricAssignment[]; recipeReferenceId: string; renderReferenceId: string | null; exportReferenceId: string | null }
  | { type: "saved" }

function clearResult(state: LyricsWorkspaceState, sectionId: string | null) {
  return {
    ...state,
    sectionId,
    assignments: [],
    recipeReferenceId: null,
    renderReferenceId: null,
    exportReferenceId: null,
    dirty: false,
    status: "ready" as const,
  }
}

export function lyricsWorkspaceReducer(
  state: LyricsWorkspaceState,
  action: LyricsWorkspaceAction,
): LyricsWorkspaceState {
  switch (action.type) {
    case "select":
      return clearResult({ ...state, projectId: action.projectId }, action.sectionId)
    case "section":
      return clearResult(state, action.sectionId)
    case "generating":
      return { ...state, status: "generating" }
    case "generated":
      return {
        ...state,
        assignments: action.assignments,
        recipeReferenceId: action.recipeReferenceId,
        renderReferenceId: null,
        exportReferenceId: null,
        dirty: true,
        status: "editing",
      }
    case "edit":
      return {
        ...state,
        assignments: state.assignments.map((item) =>
          item.id === action.assignmentId ? { ...item, [action.field]: action.value } : item,
        ),
        renderReferenceId: null,
        exportReferenceId: null,
        dirty: true,
        status: "editing",
      }
    case "fitting":
      return { ...state, status: "fitting" }
    case "fitted":
      return {
        ...state,
        assignments: action.assignments,
        recipeReferenceId: action.recipeReferenceId,
        renderReferenceId: null,
        exportReferenceId: null,
        dirty: true,
        status: "editing",
      }
    case "auditioned":
      return { ...state, renderReferenceId: action.renderReferenceId, status: "auditioned" }
    case "exported":
      return { ...state, exportReferenceId: action.exportReferenceId, status: "exported" }
    case "reopen":
      return {
        ...state,
        assignments: action.assignments,
        recipeReferenceId: action.recipeReferenceId,
        renderReferenceId: action.renderReferenceId,
        exportReferenceId: action.exportReferenceId,
        dirty: false,
        status: "saved",
      }
    case "saved":
      return { ...state, dirty: false, status: "saved" }
  }
}

export function supportsLyricsWorkspace(
  userAgent: string,
  width: number,
  hasAdapters: boolean,
) {
  const mobile = /Mobile|Android|iPhone|iPad|Tablet/i.test(userAgent)
  return hasAdapters && !mobile && width >= 1024
}
