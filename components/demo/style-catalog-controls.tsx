"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { KeyboardProfile, StyleCatalogEntry, StyleWireMapping } from "@/lib/demo/types"
import {
  styleMappingForEntry,
  stylesForProfile,
} from "@/lib/demo/yamaha/style-catalog"
import { dbModelKey } from "@/lib/demo/yamaha/keyboard-models"
import { cn } from "@/lib/utils"

type Props = {
  profile: KeyboardProfile | null
  disabled?: boolean
  /** Fired when a style should be pushed to the keyboard (user pick or auto-select). */
  onSelectStyle: (mapping: StyleWireMapping, entry: StyleCatalogEntry) => void
  /** Current catalog selection (also updates on profile/catalog reset). */
  onActiveStyleChange?: (entry: StyleCatalogEntry | null) => void
  className?: string
  datalistId?: string
  /**
   * `demo` — public Jam Player / demos: local JSON only (no paid API).
   * `hosted` — Style Maker app: try Postgres/SQLite API, then JSON fallback.
   */
  source?: "demo" | "hosted"
  /**
   * Preselect the first catalog style and notify the parent (so Play has a
   * mapping). Parent decides whether to send SysEx immediately.
   */
  autoSelectFirst?: boolean
}

function entryKey(style: StyleCatalogEntry) {
  return `${style.styleNumber}:${style.name}`
}

/** Same search + category + style comboboxes as Jam Player — catalog from DB by model. */
export function StyleCatalogControls({
  profile,
  disabled = false,
  onSelectStyle,
  onActiveStyleChange,
  className,
  datalistId = "yamaha-style-suggestions",
  source = "hosted",
  autoSelectFirst = false,
}: Props) {
  const [styleCategory, setStyleCategory] = useState("All")
  const [styleSearch, setStyleSearch] = useState("")
  const [styleKey, setStyleKey] = useState("")
  const [availableStyles, setAvailableStyles] = useState<StyleCatalogEntry[]>([])
  const [catalogEpoch, setCatalogEpoch] = useState(0)

  const loadCatalog = useCallback(async () => {
    if (!profile) {
      setAvailableStyles([])
      setCatalogEpoch((value) => value + 1)
      return
    }

    if (source === "hosted") {
      const key = dbModelKey(profile.id)
      if (key) {
        try {
          const response = await fetch(
            `/api/style-maker/styles?modelKey=${encodeURIComponent(key)}`,
          )
          if (response.ok) {
            const data = await response.json()
            const styles = (data.styles || []) as StyleCatalogEntry[]
            if (styles.length) {
              setAvailableStyles(styles)
              setCatalogEpoch((value) => value + 1)
              return
            }
          }
        } catch {
          /* fall through to JSON */
        }
      }
    }

    setAvailableStyles(stylesForProfile(profile))
    setCatalogEpoch((value) => value + 1)
  }, [profile, source])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  const styleCategories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(availableStyles.map((style) => style.category))).sort(),
    ],
    [availableStyles],
  )

  // Search only filters the datalist suggestions — never lock the style <select>
  // to a single name after a pick (that made combobox changes look broken).
  const searchSuggestions = useMemo(() => {
    const search = styleSearch.trim().toLowerCase()
    return availableStyles.filter(
      (style) =>
        (styleCategory === "All" || style.category === styleCategory) &&
        (!search || style.name.toLowerCase().includes(search)),
    )
  }, [availableStyles, styleCategory, styleSearch])

  const categoryStyles = useMemo(
    () =>
      availableStyles.filter(
        (style) => styleCategory === "All" || style.category === styleCategory,
      ),
    [availableStyles, styleCategory],
  )

  const selectedStyle =
    availableStyles.find((style) => entryKey(style) === styleKey) || null
  const selectedStyleVisible =
    selectedStyle &&
    categoryStyles.some((style) => entryKey(style) === entryKey(selectedStyle))

  useEffect(() => {
    setStyleCategory("All")
    setStyleSearch("")
    if (autoSelectFirst && availableStyles[0] && profile) {
      const first = availableStyles[0]
      setStyleKey(entryKey(first))
      onSelectStyle(styleMappingForEntry(profile, first), first)
      return
    }
    setStyleKey("")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when catalog reloads
  }, [catalogEpoch, autoSelectFirst, profile?.id])

  useEffect(() => {
    onActiveStyleChange?.(selectedStyle)
  }, [onActiveStyleChange, selectedStyle])

  const selectStyle = (next: StyleCatalogEntry) => {
    if (!profile || disabled) return
    setStyleKey(entryKey(next))
    setStyleSearch("")
    onSelectStyle(styleMappingForEntry(profile, next), next)
  }

  return (
    <div className={cn("style-catalog-controls", className)}>
      <input
        type="search"
        list={datalistId}
        value={styleSearch}
        placeholder={
          availableStyles.length
            ? `Search ${availableStyles.length} styles`
            : profile
              ? "Loading styles…"
              : "Connect a keyboard for styles"
        }
        aria-label="Search styles"
        autoComplete="off"
        disabled={disabled || !profile || availableStyles.length === 0}
        onChange={(event) => {
          const value = event.target.value
          setStyleSearch(value)
          const exact = availableStyles.find(
            (style) => style.name.toLowerCase() === value.trim().toLowerCase(),
          )
          if (exact) selectStyle(exact)
        }}
      />
      <datalist id={datalistId}>
        {searchSuggestions.map((style) => (
          <option key={entryKey(style)} value={style.name}>
            {style.category}
          </option>
        ))}
      </datalist>
      <select
        value={styleCategory}
        aria-label="Style category"
        disabled={disabled || !profile || availableStyles.length === 0}
        onChange={(event) => setStyleCategory(event.target.value)}
      >
        {styleCategories.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <select
        value={selectedStyleVisible && selectedStyle ? entryKey(selectedStyle) : ""}
        aria-label="Yamaha style"
        disabled={disabled || !profile || availableStyles.length === 0}
        onChange={(event) => {
          const next = availableStyles.find(
            (style) => entryKey(style) === event.target.value,
          )
          if (next) selectStyle(next)
        }}
      >
        <option value="">
          {categoryStyles.length ? "Choose a style…" : "No matching styles"}
        </option>
        {categoryStyles.map((style) => (
          <option key={entryKey(style)} value={entryKey(style)}>
            {style.name}
            {style.bpm ? ` · ${style.bpm} BPM` : ""}
          </option>
        ))}
      </select>
      <span>
        {selectedStyle?.name ||
          (availableStyles.length ? "No style selected" : "No style available")}
        {profile ? ` · ${profile.displayName}` : ""}
      </span>
    </div>
  )
}
