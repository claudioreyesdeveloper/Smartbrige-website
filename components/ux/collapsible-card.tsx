"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Props = {
  title: string
  summary?: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  className?: string
}

/** Collapsible secondary controls (tyros StylesSelector pattern). */
export function CollapsibleCard({
  title,
  summary,
  open,
  onOpenChange,
  children,
  className,
}: Props) {
  return (
    <div className={cn("ux-collapse", className)}>
      <button
        type="button"
        className="ux-collapse-head"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        <div className="ux-collapse-titles">
          <span className="ux-collapse-title">{title}</span>
          {!open && summary ? (
            <span className="ux-collapse-summary">{summary}</span>
          ) : null}
        </div>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open ? <div className="ux-collapse-body">{children}</div> : null}
    </div>
  )
}
