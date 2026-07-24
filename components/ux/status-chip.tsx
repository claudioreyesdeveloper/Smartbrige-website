import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
  on?: boolean
  className?: string
}

/** MIDI / readiness status pill (tyros Home footer chip structure). */
export function StatusChip({ children, on = false, className }: Props) {
  return (
    <span className={cn("ux-status-chip", on && "is-on", className)}>
      <span className="ux-status-dot" aria-hidden />
      {children}
    </span>
  )
}
