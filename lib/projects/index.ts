export {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  assertDocumentWithinSizeLimit,
  cloneProjectDocument,
  createEmptyProjectDocument,
  measureDocumentBytes,
  migrateProjectDocument,
  parseAndValidateProjectDocument,
  type ProjectBlobPurpose,
  type ProjectBlobRef,
  type ProjectChord,
  type ProjectDocument,
  type ProjectDocumentV1,
  type ProjectLyricSyllable,
  type ProjectLyrics,
  type ProjectMixerChannel,
  type ProjectMixerState,
  type ProjectRecipe,
  type ProjectSection,
  type ProjectSoloTake,
  type ProjectSong,
  type ProjectStylePart,
  type ProjectStyleRef,
} from "@/lib/projects/document"
export { ProjectError, projectErrorHttpStatus, type ProjectErrorCode } from "@/lib/projects/errors"
export {
  PROJECT_API_BODY_MAX_BYTES,
  PROJECT_BLOBS_MAX,
  PROJECT_CHORDS_PER_SECTION_MAX,
  PROJECT_DOCUMENT_MAX_BYTES,
  PROJECT_LYRICS_TEXT_MAX,
  PROJECT_MIXER_CHANNELS_MAX,
  PROJECT_SECTIONS_MAX,
  PROJECT_SOLOS_MAX,
  PROJECT_TITLE_MAX_LENGTH,
} from "@/lib/projects/limits"
export { MemoryProjectStore } from "@/lib/projects/memory-store"
export { NeonProjectStore } from "@/lib/projects/neon-store"
export { getProjectService, setProjectServiceForTests } from "@/lib/projects/runtime"
export {
  ProjectService,
  type AccountExportPayload,
  type CreateProjectParams,
  type ProjectDetail,
  type ProjectExportPayload,
  type ProjectSaveResult,
  type ProjectSummary,
  type SaveProjectParams,
} from "@/lib/projects/service"
export type {
  AppendRevisionInput,
  BlobReferenceRow,
  CreateProjectInput,
  ProjectRevisionRow,
  ProjectRow,
  ProjectStore,
  ProjectWithRevision,
} from "@/lib/projects/store"
