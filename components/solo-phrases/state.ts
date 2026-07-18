import type {
  PreparedSoloAudition,
  SavedSoloTake,
  SoloPlaybackState,
  SoloTakeSummary,
} from "./types"

export type SoloWorkspaceState = {
  projectId: string | null
  sectionId: string | null
  takes: SoloTakeSummary[]
  selectedTakeId: string | null
  preparedAudition: PreparedSoloAudition | null
  playback: SoloPlaybackState
  savedTake: SavedSoloTake | null
  generating: boolean
  saving: boolean
}

export type SoloWorkspaceAction =
  | { type: "open-context"; projectId: string; sectionId: string | null; savedTake: SavedSoloTake | null }
  | { type: "select-section"; sectionId: string; savedTake: SavedSoloTake | null }
  | { type: "generation-started" }
  | { type: "generation-completed"; takes: SoloTakeSummary[] }
  | { type: "select-take"; takeId: string }
  | { type: "audition-prepared"; audition: PreparedSoloAudition }
  | { type: "playback"; playback: SoloPlaybackState }
  | { type: "saving-started" }
  | { type: "saved"; savedTake: SavedSoloTake }
  | { type: "operation-failed" }

const idlePlayback: SoloPlaybackState = {
  status: "idle",
  takeId: null,
  label: null,
  statusLabel: "Ready",
}

export const initialSoloWorkspaceState: SoloWorkspaceState = {
  projectId: null,
  sectionId: null,
  takes: [],
  selectedTakeId: null,
  preparedAudition: null,
  playback: idlePlayback,
  savedTake: null,
  generating: false,
  saving: false,
}

function resetContext(
  state: SoloWorkspaceState,
  context: Pick<SoloWorkspaceState, "projectId" | "sectionId" | "savedTake">,
): SoloWorkspaceState {
  return {
    ...state,
    ...context,
    takes: [],
    selectedTakeId: null,
    preparedAudition: null,
    playback: idlePlayback,
    generating: false,
    saving: false,
  }
}

export function soloWorkspaceReducer(
  state: SoloWorkspaceState,
  action: SoloWorkspaceAction,
): SoloWorkspaceState {
  switch (action.type) {
    case "open-context":
      return resetContext(state, action)
    case "select-section":
      return resetContext(state, {
        projectId: state.projectId,
        sectionId: action.sectionId,
        savedTake: action.savedTake,
      })
    case "generation-started":
      return {
        ...state,
        generating: true,
        takes: [],
        selectedTakeId: null,
        preparedAudition: null,
      }
    case "generation-completed":
      return {
        ...state,
        generating: false,
        takes: action.takes,
        selectedTakeId: action.takes[0]?.takeId ?? null,
        preparedAudition: null,
      }
    case "select-take":
      return {
        ...state,
        selectedTakeId: action.takeId,
        preparedAudition:
          state.preparedAudition?.takeId === action.takeId
            ? state.preparedAudition
            : null,
      }
    case "audition-prepared":
      return { ...state, preparedAudition: action.audition }
    case "playback":
      return { ...state, playback: action.playback }
    case "saving-started":
      return { ...state, saving: true }
    case "saved":
      return { ...state, saving: false, savedTake: action.savedTake }
    case "operation-failed":
      return { ...state, generating: false, saving: false }
  }
}

export function supportsSoloWorkspace(
  userAgent: string,
  isSecureContext: boolean,
): boolean {
  const desktop = !/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
  const chrome = /Chrome\//.test(userAgent) && !/OPR\//.test(userAgent)
  const edge = /Edg\//.test(userAgent)
  return desktop && (chrome || edge) && isSecureContext
}
