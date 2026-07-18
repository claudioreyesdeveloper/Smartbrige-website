"use client"

import type { ProjectConflictState } from "@/lib/projects/client"

type ProjectConflictPanelProps = {
  conflict: ProjectConflictState
  onReload: () => void
  onDownloadCopy: () => void
  busy?: boolean
}

/**
 * Conflict resolution choices after a stale 409:
 * reload server revision, or download the local draft copy.
 */
export function ProjectConflictPanel({
  conflict,
  onReload,
  onDownloadCopy,
  busy = false,
}: ProjectConflictPanelProps) {
  return (
    <div className="project-conflict-panel" role="alertdialog" aria-labelledby="project-conflict-title">
      <h2 id="project-conflict-title" className="project-conflict-title">
        Project conflict
      </h2>
      <p className="project-conflict-message">{conflict.message}</p>
      <p className="project-conflict-copy">
        Another revision is on the server. Reload to discard your local edits, or download a copy of
        your unsaved document first.
      </p>
      <div className="project-conflict-actions">
        <button type="button" onClick={onReload} disabled={busy}>
          Reload server version
        </button>
        <button type="button" onClick={onDownloadCopy} disabled={busy}>
          Download local copy
        </button>
      </div>
    </div>
  )
}
