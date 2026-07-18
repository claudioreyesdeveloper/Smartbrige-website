export {
  createProjectApiClient,
  needsDocumentMigration,
  parseProjectDetail,
  type ParsedProjectDetail,
  type ProjectApiClient,
  type ProjectApiClientOptions,
  type ProjectFetch,
} from "@/lib/projects/client/api"
export {
  browserDownload,
  serializeLocalProjectCopy,
  type ProjectDownloadFn,
} from "@/lib/projects/client/download"
export {
  removeBlobReference,
  setBassRecipe,
  setBlobReferences,
  setDrumsRecipe,
  setRecipeRenderBlobId,
  setSongTitle,
  upsertBlobReference,
} from "@/lib/projects/client/editors"
export {
  createNavigationGuard,
  type NavigationGuard,
} from "@/lib/projects/client/navigation"
export {
  createProjectSession,
  ProjectSession,
  type ProjectSessionDeps,
} from "@/lib/projects/client/session"
export {
  browserClock,
  browserTimer,
  type ProjectClock,
  type ProjectTimer,
  type ProjectTimerHandle,
} from "@/lib/projects/client/timers"
export {
  createTransportActivity,
  type TransportActivity,
} from "@/lib/projects/client/transport"
export {
  DEFAULT_AUTOSAVE_DELAY_MS,
  NAVIGATION_WARNING,
  ProjectClientError,
  type ClientProjectDetail,
  type ClientProjectExport,
  type ClientProjectSummary,
  type ProjectClientErrorCode,
  type ProjectConflictChoice,
  type ProjectConflictState,
  type ProjectDocumentPatch,
  type ProjectSaveState,
  type ProjectSessionPhase,
  type ProjectSessionSnapshot,
} from "@/lib/projects/client/types"
