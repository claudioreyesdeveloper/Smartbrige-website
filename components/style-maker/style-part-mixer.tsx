"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Music2, SlidersHorizontal } from "lucide-react"
import {
  ALL_STYLE_MAKER_LANES,
  StyleMakerLane,
} from "@/lib/style-maker/lanes"
import {
  displayMixerForLane,
  laneRowTitle,
  voiceLookupKey,
  type PartMixerMap,
  type ResolvedVoiceLabel,
  type TemplatePartSnapshot,
} from "@/lib/style-maker/part-mixer"
import { RotaryKnob } from "@/components/ui/rotary-knob"

type KeyboardVoiceRow = {
  id: number
  msb: number
  lsb: number
  programYamaha: number
  name: string
  category: string | null
  subCategory: string | null
}

type Props = {
  sectionNames: string[]
  sectionName: string
  onSectionChange: (name: string) => void
  workingMixer: PartMixerMap
  templateSnapshots: Partial<Record<StyleMakerLane, TemplatePartSnapshot>>
  dirty: boolean
  statusText: string
  /** Connected keyboard model id (website YamahaModelId / DB model_key). */
  modelKey?: string | null
  onSaveSectionMix: () => void
  onCopyVoicesToAllSections: () => void
  onPartValueChange: (
    lane: StyleMakerLane,
    field: "volume" | "pan" | "reverb" | "chorus",
    value: number,
  ) => void
  onVoiceSelected: (
    lane: StyleMakerLane,
    voice: {
      msb: number
      lsb: number
      programYamaha: number
      name: string
      category?: string | null
      subCategory?: string | null
    },
  ) => void
}

function VolumeSlider(props: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="sm-mix-vol">
      <input
        type="range"
        min={0}
        max={127}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
        aria-label="Volume"
      />
      <span>{props.value}</span>
    </div>
  )
}

function collectVoiceKeys(
  working: PartMixerMap,
  templates: Partial<Record<StyleMakerLane, TemplatePartSnapshot>>,
): { msb: number; lsb: number; programYamaha: number }[] {
  const keys: { msb: number; lsb: number; programYamaha: number }[] = []
  const seen = new Set<string>()
  const push = (msb: number, lsb: number, programYamaha: number) => {
    const id = voiceLookupKey(msb, lsb, programYamaha)
    if (seen.has(id)) return
    seen.add(id)
    keys.push({ msb, lsb, programYamaha })
  }
  for (const lane of ALL_STYLE_MAKER_LANES) {
    const w = working[lane]
    if (w?.hasVoice) push(w.voiceMSB, w.voiceLSB, w.voiceProgram)
    const o = templates[lane]?.mixer
    if (o?.hasVoice) push(o.voiceMSB, o.voiceLSB, o.voiceProgram)
  }
  return keys
}

export function StylePartMixerPanel(props: Props) {
  const [voiceLane, setVoiceLane] = useState<StyleMakerLane | null>(null)
  const [voiceQ, setVoiceQ] = useState("")
  const [voiceCategory, setVoiceCategory] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [voices, setVoices] = useState<KeyboardVoiceRow[]>([])
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [voiceError, setVoiceError] = useState("")
  const [resolvedVoices, setResolvedVoices] = useState<
    Record<string, ResolvedVoiceLabel>
  >({})

  const voiceKeys = useMemo(
    () => collectVoiceKeys(props.workingMixer, props.templateSnapshots),
    [props.templateSnapshots, props.workingMixer],
  )
  const voiceKeysSignature = useMemo(
    () =>
      voiceKeys
        .map((k) => voiceLookupKey(k.msb, k.lsb, k.programYamaha))
        .sort()
        .join("|"),
    [voiceKeys],
  )

  // Resolve MSB/LSB/PRG → keyboard_voices name + category (active model).
  useEffect(() => {
    if (!voiceKeys.length) {
      setResolvedVoices({})
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch("/api/style-maker/voices/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voices: voiceKeys,
            modelKey: props.modelKey || null,
          }),
        })
        const data = await response.json()
        if (cancelled || !response.ok) return
        const next: Record<string, ResolvedVoiceLabel> = {}
        const map = (data.voices || {}) as Record<string, KeyboardVoiceRow>
        for (const [key, voice] of Object.entries(map)) {
          next[key] = {
            name: voice.name,
            category: voice.category,
            subCategory: voice.subCategory,
          }
        }
        setResolvedVoices(next)
      } catch {
        if (!cancelled) setResolvedVoices({})
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature tracks keys + model
  }, [voiceKeysSignature, props.modelKey])

  const loadVoices = useCallback(async () => {
    setLoadingVoices(true)
    setVoiceError("")
    try {
      const params = new URLSearchParams({ limit: "100" })
      if (voiceQ.trim()) params.set("q", voiceQ.trim())
      if (voiceCategory) params.set("category", voiceCategory)
      if (props.modelKey) params.set("modelKey", props.modelKey)
      const response = await fetch(`/api/style-maker/voices?${params}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Voice search failed")
      }
      setVoices(data.voices || [])
      if (Array.isArray(data.categories)) setCategories(data.categories)
    } catch (error) {
      setVoices([])
      setVoiceError(
        error instanceof Error ? error.message : "Voice search failed",
      )
    } finally {
      setLoadingVoices(false)
    }
  }, [props.modelKey, voiceCategory, voiceQ])

  useEffect(() => {
    if (voiceLane === null) return
    const handle = window.setTimeout(() => void loadVoices(), 120)
    return () => window.clearTimeout(handle)
  }, [loadVoices, voiceLane])

  const rows = useMemo(
    () =>
      ALL_STYLE_MAKER_LANES.map((lane) => {
        const working = props.workingMixer[lane]
        const original = props.templateSnapshots[lane]?.mixer
        const workingKey =
          working?.hasVoice
            ? voiceLookupKey(
                working.voiceMSB,
                working.voiceLSB,
                working.voiceProgram,
              )
            : ""
        const originalKey =
          original?.hasVoice
            ? voiceLookupKey(
                original.voiceMSB,
                original.voiceLSB,
                original.voiceProgram,
              )
            : ""
        const display = displayMixerForLane(working, original, {
          working: workingKey ? resolvedVoices[workingKey] : null,
          original: originalKey ? resolvedVoices[originalKey] : null,
        })
        return { lane, display }
      }),
    [props.templateSnapshots, props.workingMixer, resolvedVoices],
  )

  return (
    <div className="sm-part-mixer">
      <h2 className="sm-part-mixer-title">
        Style Part Mixer – voices, volume, pan, reverb, chorus for Yamaha style
        channels 9–16
      </h2>

      <div className="sm-part-mixer-controls">
        <label>
          Section
          <select
            value={props.sectionName}
            onChange={(event) => props.onSectionChange(event.target.value)}
          >
            {(props.sectionNames.length
              ? props.sectionNames
              : [props.sectionName]
            ).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="sm-btn is-primary"
          disabled={!props.dirty}
          onClick={props.onSaveSectionMix}
        >
          Save section mix
        </button>
        <button
          type="button"
          className="sm-btn"
          title="Copy the voices currently set on this section to the same lanes in every other section."
          onClick={props.onCopyVoicesToAllSections}
        >
          Copy voices to all sections
        </button>
      </div>

      <div className="sm-part-mixer-rows">
        {rows.map(({ lane, display }) => {
          const channel = lane + 9
          return (
            <div className="sm-mix-row" key={lane}>
              <div className="sm-mix-ch">{channel}</div>
              <div className="sm-mix-meta">
                <button
                  type="button"
                  className="sm-mix-voice-btn"
                  onClick={() => {
                    setVoiceLane(lane)
                    setVoiceQ("")
                    setVoiceCategory("")
                  }}
                  title="Choose voice"
                >
                  <Music2 size={18} strokeWidth={2} />
                  <span>{display.voiceLabel}</span>
                </button>
                <div className="sm-mix-name">{laneRowTitle(lane)}</div>
              </div>
              <VolumeSlider
                value={display.volume}
                onChange={(value) =>
                  props.onPartValueChange(lane, "volume", value)
                }
              />
              <RotaryKnob
                value={display.pan}
                onChange={(value) =>
                  props.onPartValueChange(lane, "pan", value)
                }
                displayValue={String(display.pan)}
                label="Pan"
                size="xs"
              />
              <RotaryKnob
                value={display.reverb}
                onChange={(value) =>
                  props.onPartValueChange(lane, "reverb", value)
                }
                displayValue={String(display.reverb)}
                label="Rev"
                size="xs"
              />
              <RotaryKnob
                value={display.chorus}
                onChange={(value) =>
                  props.onPartValueChange(lane, "chorus", value)
                }
                displayValue={String(display.chorus)}
                label="Cho"
                size="xs"
              />
              <button
                type="button"
                className="sm-mix-action"
                onClick={() => {
                  setVoiceLane(lane)
                  setVoiceQ("")
                  setVoiceCategory("")
                }}
                title="Voice browser"
                aria-label={`Voice for ${laneRowTitle(lane)}`}
              >
                <SlidersHorizontal size={16} strokeWidth={2.25} />
              </button>
            </div>
          )
        })}
      </div>

      <p className="sm-part-mixer-status">{props.statusText}</p>

      {voiceLane !== null && (
        <div className="sm-modal-backdrop" role="presentation">
          <div
            className="sm-modal sm-voice-modal"
            role="dialog"
            aria-label={`Select Voice for channel ${voiceLane + 9}`}
          >
            <h3>Select Voice for {laneRowTitle(voiceLane)}</h3>
            <div className="sm-voice-filters">
              <label>
                Search
                <input
                  type="text"
                  value={voiceQ}
                  onChange={(event) => setVoiceQ(event.target.value)}
                  placeholder="Voice name…"
                  autoFocus
                />
              </label>
              <label>
                Category
                <select
                  value={voiceCategory}
                  onChange={(event) => setVoiceCategory(event.target.value)}
                >
                  <option value="">All</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {voiceError ? (
              <p className="sm-modal-error">{voiceError}</p>
            ) : null}
            <div className="sm-voice-list">
              {loadingVoices ? (
                <p>Loading voices…</p>
              ) : voices.length === 0 ? (
                <p>No voices match.</p>
              ) : (
                voices.map((voice) => (
                  <button
                    key={voice.id}
                    type="button"
                    className="sm-voice-row"
                    onClick={() => {
                      props.onVoiceSelected(voiceLane, {
                        msb: voice.msb,
                        lsb: voice.lsb,
                        programYamaha: voice.programYamaha,
                        name: voice.name,
                        category: voice.category,
                        subCategory: voice.subCategory,
                      })
                      // Optimistic cache so the row updates before resolve round-trip.
                      setResolvedVoices((prev) => ({
                        ...prev,
                        [voiceLookupKey(
                          voice.msb,
                          voice.lsb,
                          voice.programYamaha,
                        )]: {
                          name: voice.name,
                          category: voice.category,
                          subCategory: voice.subCategory,
                        },
                      }))
                      setVoiceLane(null)
                    }}
                  >
                    <span className="sm-voice-row-name">{voice.name}</span>
                    <span className="sm-voice-row-meta">
                      {voice.category || "—"}
                      {voice.subCategory ? ` / ${voice.subCategory}` : ""}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="sm-modal-actions">
              <button
                type="button"
                className="sm-btn"
                onClick={() => setVoiceLane(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
