"use client"

import type { ClientProjectSummary, ProjectSessionSnapshot } from "@/lib/projects/client"

type ProjectBrowserProps = {
  snapshot: ProjectSessionSnapshot
  onRefresh: () => void
  onCreate: () => void
  onOpen: (projectId: string) => void
  onDelete?: () => void
  onExport?: () => void
  disabled?: boolean
}

/**
 * Minimal list/create/open chrome — not a musical editor.
 */
export function ProjectBrowser({
  snapshot,
  onRefresh,
  onCreate,
  onOpen,
  onDelete,
  onExport,
  disabled = false,
}: ProjectBrowserProps) {
  return (
    <section className="project-browser" aria-labelledby="project-browser-heading">
      <div className="project-browser-header">
        <h2 id="project-browser-heading">Projects</h2>
        <div className="project-browser-actions">
          <button type="button" onClick={onRefresh} disabled={disabled}>
            Refresh
          </button>
          <button type="button" onClick={onCreate} disabled={disabled}>
            New project
          </button>
          {snapshot.projectId && onExport ? (
            <button type="button" onClick={onExport} disabled={disabled}>
              Export
            </button>
          ) : null}
          {snapshot.projectId && onDelete ? (
            <button type="button" onClick={onDelete} disabled={disabled}>
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {snapshot.projectId ? (
        <p className="project-browser-open">
          Open: <strong>{snapshot.title}</strong>{" "}
          <span>
            v{snapshot.version ?? "?"} ({snapshot.revisionId?.slice(0, 8) ?? "—"})
          </span>
        </p>
      ) : (
        <p className="project-browser-open">No project open</p>
      )}

      <ul className="project-browser-list">
        {snapshot.projects.map((project: ClientProjectSummary) => {
          const selected = project.id === snapshot.projectId
          return (
            <li key={project.id}>
              <button
                type="button"
                className={selected ? "project-browser-item project-browser-item-selected" : "project-browser-item"}
                onClick={() => onOpen(project.id)}
                disabled={disabled}
              >
                <span>{project.title}</span>
                <span>
                  v{project.currentVersion ?? "—"} · {project.updatedAt}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
