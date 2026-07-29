"use client"

import { useEffect, useMemo, useState } from "react"
import type { Progression } from "@/lib/band-jam/engine/types"
import { cn } from "@/lib/utils"

const JAM_PLAYER_CATEGORIES = [
  "Pop",
  "Rock",
  "Ballad",
  "Dance",
  "Latin",
  "Swing&Jazz",
  "R&B",
  "Country",
  "Ballroom",
  "World",
  "Movie&Show",
  "Entertainer",
  "User",
] as const

export type SongBrowserFilters = {
  category: string
  tonality: "any" | "major" | "minor"
  tempoBand: "any" | "slow" | "medium" | "fast"
  timeSignature: string
}

export function mapToJamPlayerCategory(category = ""): string {
  if (["User", "Chord Sheets"].includes(category)) return "User"
  if (["Pop", "Hooks", "Keys", "New"].includes(category)) return "Pop"
  if (["Rock", "Metal", "Acoustic"].includes(category)) return "Rock"
  if (["Ballads", "Atmospheric", "Classic"].includes(category)) return "Ballad"
  if (["Dance & Electronic", "Electronic", "Hip Hop"].includes(category))
    return "Dance"
  if (category === "Latin") return "Latin"
  if (["Jazz", "Swing", "Blues", "Shuffles"].includes(category)) return "Swing&Jazz"
  if (["Soul", "Funk", "Gospel", "Organ", "Fusion"].includes(category)) return "R&B"
  if (category === "Country") return "Country"
  if (category === "Orchestral") return "Ballroom"
  if (["World", "Reggae"].includes(category)) return "World"
  if (["Cinematic", "Musicals", "Movie Scores", "Movie&Show"].includes(category))
    return "Movie&Show"
  if (category === "Entertainer") return "Entertainer"
  return "User"
}

export function progressionTimeSignature(progression: Progression): string {
  return progression.timeSignature || "4/4"
}

export function filterSongs(
  progressions: Progression[],
  filters: SongBrowserFilters,
): Progression[] {
  return progressions
    .filter((progression) => {
      if (
        filters.category &&
        mapToJamPlayerCategory(progression.category) !== filters.category
      )
        return false

      if (filters.tonality !== "any") {
        const minor = progression.keyLabel.trim().toLowerCase().endsWith("m")
        if (filters.tonality === "major" && minor) return false
        if (filters.tonality === "minor" && !minor) return false
      }

      const bpm = progression.tempo ?? 120
      if (filters.tempoBand === "slow" && bpm >= 90) return false
      if (filters.tempoBand === "medium" && (bpm < 90 || bpm > 130)) return false
      if (filters.tempoBand === "fast" && bpm <= 130) return false

      return (
        !filters.timeSignature ||
        progressionTimeSignature(progression) === filters.timeSignature
      )
    })
    .sort((a, b) =>
      (a.category || "").localeCompare(b.category || "", undefined, {
        sensitivity: "base",
      }),
    )
}

export function songDisplayLabel(progression: Progression): string {
  const category = progression.category || "User"
  const bpm = progression.tempo ?? 120
  const reharm = progression.reharmStyles?.length ? " R" : ""
  return `${category} - ${progression.name} (${bpm} bpm + ${progression.keyLabel} + ${progressionTimeSignature(progression)})${reharm}`
}

export type SongBrowserProps = {
  progressions: Progression[]
  selectedId: string
  onSelect: (progression: Progression) => void
  className?: string
}

export function SongBrowser({
  progressions,
  selectedId,
  onSelect,
  className,
}: SongBrowserProps) {
  const timeSignatures = useMemo(
    () =>
      [...new Set(progressions.map(progressionTimeSignature))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    [progressions],
  )
  const [category, setCategory] = useState("")
  const [tonality, setTonality] = useState<SongBrowserFilters["tonality"]>("any")
  const [tempoBand, setTempoBand] = useState<SongBrowserFilters["tempoBand"]>("any")
  const [timeSignature, setTimeSignature] = useState(
    timeSignatures.includes("4/4") ? "4/4" : "",
  )

  useEffect(() => {
    if (timeSignature && !timeSignatures.includes(timeSignature))
      setTimeSignature(timeSignatures.includes("4/4") ? "4/4" : "")
  }, [timeSignature, timeSignatures])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const progression of progressions) {
      const mapped = mapToJamPlayerCategory(progression.category)
      counts.set(mapped, (counts.get(mapped) ?? 0) + 1)
    }
    return counts
  }, [progressions])

  const filtered = useMemo(
    () =>
      filterSongs(progressions, {
        category,
        tonality,
        tempoBand,
        timeSignature,
      }),
    [progressions, category, tonality, tempoBand, timeSignature],
  )

  useEffect(() => {
    if (filtered.length && !filtered.some((song) => song.id === selectedId))
      onSelect(filtered[0])
  }, [filtered, selectedId, onSelect])

  const selectClass =
    "min-h-11 w-full rounded-xl border border-white/10 bg-[#111] px-3 text-sm text-white outline-none focus:border-orange-400/45"
  const compactSelectClass =
    "min-h-11 min-w-0 w-full rounded-xl border border-white/10 bg-[#111] px-2 text-xs text-white outline-none focus:border-orange-400/45"
  const selectedValue = filtered.some((song) => song.id === selectedId) ? selectedId : ""

  return (
    <div className={cn("space-y-3", className)}>
      <label className="block">
        <span className="mb-1.5 block text-[10px] tracking-[0.16em] text-white/35 uppercase">
          Category
        </span>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={selectClass}
          aria-label="Song category"
        >
          <option value="">All Categories ({progressions.length})</option>
          {JAM_PLAYER_CATEGORIES.map((name) => (
            <option key={name} value={name}>
              {name} ({categoryCounts.get(name) ?? 0})
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-[0.9fr_1.25fr_0.7fr] gap-2">
        <select
          value={tonality}
          onChange={(event) =>
            setTonality(event.target.value as SongBrowserFilters["tonality"])
          }
          className={compactSelectClass}
          aria-label="Song key"
        >
          <option value="any">Any Key</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
        </select>
        <select
          value={tempoBand}
          onChange={(event) =>
            setTempoBand(event.target.value as SongBrowserFilters["tempoBand"])
          }
          className={compactSelectClass}
          aria-label="Song tempo"
        >
          <option value="any">Any BPM</option>
          <option value="slow">Slow (&lt;90)</option>
          <option value="medium">Medium (90–130)</option>
          <option value="fast">Fast (&gt;130)</option>
        </select>
        <select
          value={timeSignature}
          onChange={(event) => setTimeSignature(event.target.value)}
          className={compactSelectClass}
          aria-label="Song time signature"
        >
          <option value="">Any Time</option>
          {timeSignatures.map((signature) => (
            <option key={signature} value={signature}>
              {signature}
            </option>
          ))}
        </select>
      </div>

      <select
        value={selectedValue}
        onChange={(event) => {
          const selected = progressions.find((song) => song.id === event.target.value)
          if (selected) onSelect(selected)
        }}
        disabled={!filtered.length}
        className={selectClass}
        aria-label="Song"
      >
        {!filtered.length ? <option value="">No matching songs</option> : null}
        {filtered.map((song) => (
          <option key={song.id} value={song.id}>
            {songDisplayLabel(song)}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-white/30">
        {filtered.length} matching {filtered.length === 1 ? "song" : "songs"}
      </p>
    </div>
  )
}
