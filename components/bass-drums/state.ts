import type { AuditionState, RhythmPart } from "./types"

export type RhythmWorkspaceState = {
  activeTab: RhythmPart
  projectId: string | null
  sectionId: string | null
  bassCandidateId: string | null
  drumCandidateId: string | null
  fillCandidateId: string | null
  fillSlots: Record<number, string>
  suggestedDrums: boolean
  loadingContext: boolean
  audition: AuditionState
  appliedSummary: string | null
}

export type RhythmWorkspaceAction =
  | { type: "select-tab"; tab: RhythmPart }
  | { type: "select-project"; projectId: string; sectionId: string | null }
  | { type: "select-section"; sectionId: string }
  | { type: "context-loaded" }
  | { type: "select-bass"; candidateId: string }
  | { type: "select-drums"; candidateId: string }
  | { type: "select-fill"; candidateId: string }
  | { type: "show-suggested" }
  | { type: "clear-suggested" }
  | { type: "assign-fill"; slot: number; candidateId: string }
  | { type: "audition"; state: AuditionState }
  | { type: "applied"; summary: string }

export const initialRhythmWorkspaceState: RhythmWorkspaceState = {
  activeTab: "bass",
  projectId: null,
  sectionId: null,
  bassCandidateId: null,
  drumCandidateId: null,
  fillCandidateId: null,
  fillSlots: {},
  suggestedDrums: false,
  loadingContext: true,
  audition: {
    status: "idle",
    renderReferenceId: null,
    label: null,
    error: null,
  },
  appliedSummary: null,
}

function resetSelection(state: RhythmWorkspaceState): RhythmWorkspaceState {
  return {
    ...state,
    bassCandidateId: null,
    drumCandidateId: null,
    fillCandidateId: null,
    fillSlots: {},
    suggestedDrums: false,
    loadingContext: true,
    appliedSummary: null,
  }
}

export function rhythmWorkspaceReducer(
  state: RhythmWorkspaceState,
  action: RhythmWorkspaceAction,
): RhythmWorkspaceState {
  switch (action.type) {
    case "select-tab":
      return { ...state, activeTab: action.tab }
    case "select-project":
      return resetSelection({
        ...state,
        projectId: action.projectId,
        sectionId: action.sectionId,
      })
    case "select-section":
      return resetSelection({ ...state, sectionId: action.sectionId })
    case "context-loaded":
      return { ...state, loadingContext: false }
    case "select-bass":
      return {
        ...state,
        bassCandidateId: action.candidateId,
        suggestedDrums: false,
        drumCandidateId: null,
        fillCandidateId: null,
        fillSlots: {},
      }
    case "select-drums":
      return {
        ...state,
        drumCandidateId: action.candidateId,
        fillCandidateId: null,
        fillSlots: {},
      }
    case "select-fill":
      return { ...state, fillCandidateId: action.candidateId }
    case "show-suggested":
      if (!state.bassCandidateId) return state
      return {
        ...state,
        activeTab: "drums",
        suggestedDrums: true,
        drumCandidateId: null,
        fillCandidateId: null,
        fillSlots: {},
        loadingContext: true,
      }
    case "clear-suggested":
      return { ...state, suggestedDrums: false, loadingContext: true }
    case "assign-fill":
      return {
        ...state,
        fillSlots: { ...state.fillSlots, [action.slot]: action.candidateId },
      }
    case "audition":
      return { ...state, audition: action.state }
    case "applied":
      return { ...state, appliedSummary: action.summary }
  }
}

export function supportsRhythmWorkspace(
  userAgent: string,
  isSecureContext: boolean,
): boolean {
  const desktop = !/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
  const chrome = /Chrome\//.test(userAgent) && !/OPR\//.test(userAgent)
  const edge = /Edg\//.test(userAgent)
  return desktop && (chrome || edge) && isSecureContext
}
