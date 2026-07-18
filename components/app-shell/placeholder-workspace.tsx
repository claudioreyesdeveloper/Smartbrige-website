import type { ReactNode } from "react"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

type PlaceholderWorkspaceProps = {
  title: string
  description: string
  children?: ReactNode
}

export function PlaceholderWorkspace({
  title,
  description,
  children,
}: PlaceholderWorkspaceProps) {
  return (
    <div className="app-shell-workspace">
      <p className="app-shell-workspace-lead">{description}</p>

      <div className="app-shell-workspace-panel" role="status">
        <p className="app-shell-workspace-status">
          This module shell is ready. The full {title} workspace ships in a later release.
        </p>
        {children}
        <p className="app-shell-workspace-demo">
          Want to try the concept now?{" "}
          <Link href="/demo" className="app-shell-inline-link">
            Open the public demo
            <ExternalLink size={14} aria-hidden="true" />
          </Link>
        </p>
      </div>
    </div>
  )
}
