"use client"

import { useMemo, useRef, useState } from "react"
import { Check, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Progression } from "@/lib/band-jam/engine/types"

/**
 * Searchable progression picker.
 *
 * A native <select> over 400 items is unusable — no search, no filtering, and
 * you cannot see a progression's key or length before choosing it. This shows
 * key, bar count and section roles, and filters as you type.
 *
 * Progressions are SmartBridge songs (`jam_chord_blocks` + `factory_songs` /
 * `jam_songs` metadata), so names, tempo and category are populated. Key
 * remains the primary filter axis because every row has one.
 */

export type ProgressionPickerProps = {
  progressions: Progression[]
  selectedId: string
  onSelect: (progression: Progression) => void
  className?: string
}

function totalBars(p: Progression): number {
  return p.sections.reduce((n, s) => n + s.bars, 0)
}

export function ProgressionPicker({
  progressions,
  selectedId,
  onSelect,
  className,
}: ProgressionPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [keyFilter, setKeyFilter] = useState<string>("")
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = progressions.find((p) => p.id === selectedId)

  const keys = useMemo(
    () =>
      [...new Set(progressions.map((p) => p.keyLabel).filter(Boolean))].sort(),
    [progressions],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return progressions.filter((p) => {
      if (keyFilter && p.keyLabel !== keyFilter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.keyLabel?.toLowerCase().includes(q) ||
        p.sections.some((s) => s.label.toLowerCase().includes(q))
      )
    })
  }, [progressions, query, keyFilter])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-xl border border-white/12 bg-black/35 px-3.5 text-left text-sm text-slate-200 transition-colors hover:border-white/25",
          className,
        )}
      >
        <Search className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
        <span className="truncate">
          {selected ? selected.name : "Choose a progression"}
        </span>
        {selected?.keyLabel ? (
          <span className="ml-auto shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-xs text-slate-400">
            {selected.keyLabel}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <div
      className={cn(
        "flex max-h-[60vh] w-full flex-col gap-2 rounded-xl border border-sky-500/30 bg-black/70 p-2.5 backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Search className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false)
            if (e.key === "Enter" && filtered[0]) {
              onSelect(filtered[0])
              setOpen(false)
            }
          }}
          placeholder={`Search ${progressions.length} progressions…`}
          className="min-h-9 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          aria-label="Search progressions"
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-100"
          aria-label="Close"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        <FilterChip active={!keyFilter} onClick={() => setKeyFilter("")}>
          All keys
        </FilterChip>
        {keys.map((k) => (
          <FilterChip
            key={k}
            active={keyFilter === k}
            onClick={() => setKeyFilter(keyFilter === k ? "" : k)}
          >
            {k}
          </FilterChip>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">
            Nothing matches “{query}”
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((p) => {
              const isSel = p.id === selectedId
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(p)
                      setOpen(false)
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors",
                      isSel ? "bg-sky-500/15" : "hover:bg-white/5",
                    )}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        isSel ? "text-sky-300" : "text-transparent",
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-100">
                        {p.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {totalBars(p)} bars ·{" "}
                        {p.sections.map((s) => s.label).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-xs text-slate-400">
                      {p.keyLabel}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="px-1 text-xs text-slate-500">
        {filtered.length} of {progressions.length}
      </p>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-2 py-1 text-xs transition-colors",
        active
          ? "bg-sky-500/20 text-sky-200"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
      )}
    >
      {children}
    </button>
  )
}
