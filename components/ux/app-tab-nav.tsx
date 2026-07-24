"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type AppTabItem = {
  id: string
  label: string
  icon: LucideIcon
}

type Props = {
  tabs: AppTabItem[]
  activeId: string
  onChange: (id: string) => void
  className?: string
  "aria-label"?: string
}

/** Icon + label tabs with active underline (tyros TabNavigation structure). */
export function AppTabNav({
  tabs,
  activeId,
  onChange,
  className,
  "aria-label": ariaLabel = "Sections",
}: Props) {
  return (
    <nav className={cn("ux-tab-nav", className)} aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            className={cn("ux-tab", active && "is-active")}
            onClick={() => onChange(tab.id)}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={20} strokeWidth={2} className="ux-tab-icon" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
