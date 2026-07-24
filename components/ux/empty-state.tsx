import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Props = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/** Guided empty state: icon + title + one next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: Props) {
  return (
    <div className={cn("ux-empty", className)}>
      {Icon ? (
        <div className="ux-empty-icon" aria-hidden>
          <Icon size={32} strokeWidth={1.75} />
        </div>
      ) : null}
      <h3 className="ux-empty-title">{title}</h3>
      {description ? <p className="ux-empty-desc">{description}</p> : null}
      {action ? <div className="ux-empty-action">{action}</div> : null}
    </div>
  )
}
