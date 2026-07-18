"use client"

import type { ProjectSessionSnapshot } from "@/lib/projects/client"

const LABELS: Record<ProjectSessionSnapshot["saveState"], string> = {
  clean: "All changes saved",
  dirty: "Unsaved changes",
  scheduled: "Saving soon…",
  saving: "Saving…",
  saved: "Saved",
  conflict: "Conflict — resolve to continue",
  error: "Save failed",
}

type ProjectSaveStatusProps = {
  snapshot: ProjectSessionSnapshot
  onSave?: () => void
}

/** Compact save/dirty/conflict status for project workspaces. */
export function ProjectSaveStatus({ snapshot, onSave }: ProjectSaveStatusProps) {
  const showSave =
    snapshot.dirty ||
    snapshot.saveState === "error" ||
    snapshot.saveState === "scheduled"

  return (
    <div className="project-save-status" data-state={snapshot.saveState} role="status">
      <span className="project-save-status-label">{LABELS[snapshot.saveState]}</span>
      {snapshot.migrationApplied ? (
        <span className="project-save-status-migration">Document migrated to schema v1</span>
      ) : null}
      {snapshot.transportActive ? (
        <span className="project-save-status-transport">Playback active — saves paused</span>
      ) : null}
      {snapshot.lastError && snapshot.saveState === "error" ? (
        <span className="project-save-status-error">{snapshot.lastError}</span>
      ) : null}
      {showSave && onSave ? (
        <button type="button" className="project-save-status-button" onClick={onSave}>
          Save now
        </button>
      ) : null}
    </div>
  )
}
