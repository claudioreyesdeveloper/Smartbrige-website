"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Settings2, SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChordChart } from "@/components/band-jam/chord-chart"
import { MixerPanel } from "@/components/band-jam/mixer-panel"
import { TransportBar } from "@/components/band-jam/transport-bar"
import { ProgressionPicker } from "@/components/band-jam/progression-picker"
import { MidiScheduler, useMidiOut } from "@/lib/band-jam/engine/web-midi"
import { MidiOutControl } from "@/components/band-jam/midi-out-control"
import { VariationPicker } from "@/components/band-jam/variation-picker"
import { EffectsControl } from "@/components/band-jam/effects-control"
import {
  DEFAULT_RAMP,
  getRecord,
  loadPracticeStore,
  rampTempo,
  recordPractice,
  savePracticeStore,
  suggestSession,
  type PracticeStore,
} from "@/lib/band-jam/engine/practice-store"
import { arrange } from "@/lib/band-jam/engine/arrange"
import { BandPlayer } from "@/lib/band-jam/engine/player"
import {
  EffectsRack,
  type PartEffectSettings,
} from "@/lib/band-jam/engine/effects"
import {
  presetForStyle,
  resolveChannelEffects,
} from "@/lib/band-jam/engine/effects-presets"
import {
  instrumentForRole,
  loadInstrumentsForRoles,
} from "@/lib/band-jam/engine/instruments"
import type {
  Arrangement,
  ArrangementSection,
  BandPart,
  BandStyle,
  LoopRange,
  NoteEvent,
  PartMixState,
  Progression,
  TransportStatus,
} from "@/lib/band-jam/engine/types"

type ClipJson = Record<string, { sourceKeyPc: number; events: NoteEvent[] }>
type CatalogJson = { progressions: Progression[]; styles: BandStyle[] }

const ALL_PARTS: BandPart[] = ["drums", "bass", "guitar", "keys", "solo"]

/**
 * Parts held back from playback, PER STYLE.
 *
 * This is deliberately keyed by style rather than global. It was global once,
 * and silencing keys while the rock guitars were being judged took the Rhodes
 * and the grand out of all eight styles as collateral — the clips and samples
 * were fine, nothing was ever going to play them.
 *
 * Rock's curated Genos templates carry their harmony on the guitars; a keys
 * part on top fights them. Every other style wants its keys.
 */
const DISABLED_PARTS_BY_STYLE: Record<string, ReadonlySet<BandPart>> = {
  rock: new Set<BandPart>(["keys"]),
}

/** Styles ear-checked for the first public Jam Player cut. */
const JAM_PLAYER_LAUNCH_STYLE_IDS = ["funk", "rock", "pop", "ballad"] as const

function isPartDisabled(part: BandPart, styleId: string): boolean {
  return DISABLED_PARTS_BY_STYLE[styleId]?.has(part) ?? false
}

const emptyMix = (): Record<BandPart, PartMixState> => ({
  drums: { volume: 1, muted: false },
  bass: { volume: 1, muted: false },
  guitar: { volume: 0.8, muted: false },
  keys: { volume: 0.75, muted: false },
  solo: { volume: 0.8, muted: true },
})

export type PracticeScreenProps = {
  /**
   * From lib/billing/entitlements.ts getJamPlayerEntitlement(), computed
   * server-side in app/jam-player/app/page.tsx. Not yet used to limit
   * content — the free tier currently sees the same catalogue as paid
   * users. Wiring this through to actually restrict styles/progressions
   * for `hasFullAccess === false` is left for a follow-up
   * (docs/jam-player-product-plan.md §5 "gate on content and memory").
   */
  hasFullAccess?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- accepted now, wired into content limiting in a follow-up.
export function PracticeScreen(_props: PracticeScreenProps = {}) {
  const [catalog, setCatalog] = useState<CatalogJson | null>(null)
  const [clips, setClips] = useState<Map<number, { events: NoteEvent[]; sourceKeyPc: number }> | null>(null)
  const [loadError, setLoadError] = useState("")
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null)

  const [styleId, setStyleId] = useState<string>("")
  const [progressionId, setProgressionId] = useState<string>("")
  const [keyPc, setKeyPc] = useState(0)
  const [tempo, setTempo] = useState(100)
  const [loop, setLoop] = useState<LoopRange | null>(null)
  const [userPart, setUserPart] = useState<BandPart | null>(null)
  const [mix, setMix] = useState<Record<BandPart, PartMixState>>(emptyMix)
  const [countIn, setCountIn] = useState(true)
  const [metronome, setMetronome] = useState(false)
  const [status, setStatus] = useState<TransportStatus>("idle")
  const [currentBar, setCurrentBar] = useState<number | null>(null)
  /** Position within the current bar, 0-1. Drives the intra-bar playhead. */
  const [barPhase, setBarPhase] = useState(0)
  const [standMode, setStandMode] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<"setup" | "mix" | null>(null)
  const [soloed, setSoloed] = useState<BandPart | null>(null)
  const [fxBypassed, setFxBypassed] = useState(false)
  const [reverbWet, setReverbWet] = useState(0.22)
  const [sends, setSends] = useState<Partial<Record<BandPart, number>>>({})
  const [targetTempo, setTargetTempo] = useState<number | null>(null)
  const [variation, setVariation] = useState(0)
  const [rampOn, setRampOn] = useState(false)

  const practiceRef = useRef<PracticeStore>({})
  /** Beats accumulated since the current span started, for ramp + history. */
  const spanBeatsRef = useRef(0)
  const spanStartBeatRef = useRef(0)
  const spanStartTempoRef = useRef(0)

  const playerRef = useRef<BandPlayer | null>(null)
  const midiSchedRef = useRef<MidiScheduler | null>(null)
  const effectsRef = useRef<EffectsRack | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const readyRef = useRef(false)
  /** Which style's instrument set is currently loaded into the player. */
  const loadedStyleRef = useRef<string | null>(null)
  /**
   * Instruments need reloading (the style changed the sound source).
   *
   * SEPARATE from readyRef on purpose. Overloading readyRef for this meant the
   * arrangement-update effect below — which also checked readyRef — silently
   * stopped pushing new arrangements to the player after any style change, so
   * switching variation A/B/C/D changed the React state and nothing else.
   * They all sounded identical because the player was still holding the
   * arrangement it had before.
   */
  const instrumentsStaleRef = useRef(false)

  useEffect(() => {
    practiceRef.current = loadPracticeStore()
  }, [])

  // Web MIDI is the same event stream sent to a real keyboard instead of the
  // browser sampler. Access must be requested from a user gesture.
  const midi = useMidiOut()

  // Catalogue + clips are code-split so they stay out of the initial bundle.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [cat, clipData] = await Promise.all([
          import("@/lib/band-jam/catalog.generated.json"),
          import("@/lib/band-jam/clips.generated.json"),
        ])
        if (cancelled) return
        const c = (cat.default ?? cat) as unknown as CatalogJson
        // Launch slice: only ship styles we've ear-checked for the web mix.
        const styles = c.styles.filter((s) =>
          (JAM_PLAYER_LAUNCH_STYLE_IDS as readonly string[]).includes(s.id),
        )
        if (styles.length === 0) {
          setLoadError("No launch styles found in catalogue.")
          return
        }
        const filtered = { ...c, styles }
        const raw = (clipData.default ?? clipData) as unknown as ClipJson
        const map = new Map<number, { events: NoteEvent[]; sourceKeyPc: number }>()
        for (const [id, v] of Object.entries(raw)) {
          map.set(Number(id), { events: v.events, sourceKeyPc: v.sourceKeyPc })
        }
        setCatalog(filtered)
        setClips(map)
        const firstStyle = styles[0]
        const firstProg = filtered.progressions[0]
        if (firstStyle) {
          setStyleId(firstStyle.id)
          setTempo(firstStyle.tempoDefault)
        }
        if (firstProg) {
          setProgressionId(firstProg.id)
          setKeyPc(firstProg.keyPc)
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            "Catalogue missing. Run scripts/band_jam_pilot/export_catalog.py and export_clips.py.",
          )
          console.error(err)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const style = useMemo(
    () => catalog?.styles.find((s) => s.id === styleId) ?? null,
    [catalog, styleId],
  )
  const progression = useMemo(
    () => catalog?.progressions.find((p) => p.id === progressionId) ?? null,
    [catalog, progressionId],
  )

  const arrangement: Arrangement | null = useMemo(() => {
    if (!style || !progression || !clips) return null
    try {
      // Tempo is stamped on the arrangement for consumers that read it, but it
      // must NOT be a useMemo dependency: every tempo tick (slider / ramp)
      // rebuilt this object, and setArrangement used to stop()+play() from
      // bar 0 with a fresh count-in — the mid-song "jump back to count-in".
      const out = arrange({ style, progression, keyPc, tempo, clips, variation })
      // Disabled parts are stripped HERE, from the arrangement itself, because
      // this is the one place every consumer reads: the scheduler, the Web MIDI
      // sink, the band strip and activeParts all derive from it.
      //
      // Filtering only at instrument-load time was not enough. The player keeps
      // its `sources` and `partGains` maps across a style change, so a keys
      // voice registered while funk was loaded stayed registered, and rock's
      // keys events — still present in the arrangement — happily played through
      // it. Rock was silent on a fresh load and grew a piano the moment you
      // arrived from another style.
      return {
        ...out,
        parts: out.parts.filter((p) => !isPartDisabled(p.part, styleId)),
      }
    } catch (err) {
      console.error("arrange failed", err)
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tempo is live via setTempo
  }, [style, progression, clips, keyPc, variation, styleId])

  // Chart section / bar loops update React state; push them into the live
  // sinks so a mid-play click actually takes effect (clear already did).
  useEffect(() => {
    playerRef.current?.setLoop(loop)
    midiSchedRef.current?.setLoop(loop)
  }, [loop])

  // Resume where the last session left off, and carry the ramp target with it.
  useEffect(() => {
    if (!styleId || !progressionId || !style) return
    const rec = getRecord(practiceRef.current, styleId, progressionId)
    const s = suggestSession(rec, style.tempoDefault)
    setTempo(s.startTempo)
    setTargetTempo(s.targetTempo)
    setVariation(0)
    spanBeatsRef.current = 0
    spanStartTempoRef.current = s.startTempo
  }, [styleId, progressionId, style])

  useEffect(() => {
    if (!styleId) return
    const preset = presetForStyle(styleId)
    setReverbWet(preset.reverb.wet)
    setSends(
      Object.fromEntries(
        Object.entries(preset.parts).map(([p, s]) => [p, s?.reverbSend ?? 0]),
      ),
    )
    const rack = effectsRef.current
    if (rack && readyRef.current) void rack.applyPreset(preset)
  }, [styleId])

  const variationCount = useMemo(() => {
    if (!style) return 1
    let max = 1
    for (const part of Object.values(style.parts)) {
      for (const takes of Object.values(part?.variations ?? {})) {
        if (Array.isArray(takes)) max = Math.max(max, takes.length)
      }
    }
    return Math.min(4, max)
  }, [style])

  const activeParts = useMemo(
    () =>
      ALL_PARTS.filter(
        (p) =>
          !isPartDisabled(p, styleId) &&
          arrangement?.parts.some((x) => x.part === p),
      ),
    [arrangement, styleId],
  )

  /** Audio starts only on a user gesture — required on iOS. */
  const ensurePlayer = useCallback(async (): Promise<BandPlayer | null> => {
    if (playerRef.current && readyRef.current && !instrumentsStaleRef.current)
      return playerRef.current
    if (!arrangement) return null

    setStatus("loading")
    try {
      const ctx = ctxRef.current ?? new AudioContext()
      ctxRef.current = ctx

      // Mix bus: reverb and compression are BUS effects and cannot be baked
      // into samples — a tail per note does not sum, and a compressor that
      // sees one isolated hit cannot duck the kit. See effects.ts.
      const rack = effectsRef.current ?? new EffectsRack(ctx)
      effectsRef.current = rack

      const player =
        playerRef.current ??
        new BandPlayer(ctx, { onStatus: setStatus, effects: rack })
      playerRef.current = player

      const roles = arrangement.parts
        .map((p) => p.part)
        .filter((p) => !isPartDisabled(p, styleId))
      const loaded = await loadInstrumentsForRoles(ctx, roles, {
        styleId,
        onProgress: (id, done, total) =>
          setProgress({
            label: id,
            pct: total ? Math.round((done / total) * 100) : 0,
          }),
      })
      const preset = presetForStyle(styleId)

      // Effects are resolved per CHANNEL, not per part slot: what a channel
      // needs depends on which instrument is loaded into it (an acoustic
      // steel-string and a solid-body both arrive as "guitar"). See
      // resolveChannelEffects.
      const channelSettings = new Map<BandPart, PartEffectSettings>()
      for (const role of loaded.keys()) {
        channelSettings.set(
          role as BandPart,
          resolveChannelEffects(
            role as BandPart,
            instrumentForRole(role, styleId),
            styleId,
          ),
        )
      }

      // Cabinet IRs and amp models must both be cached BEFORE the part chains
      // are built, because createPartChain reads them synchronously and
      // silently falls back when one is missing.
      const settingsList = [...channelSettings.values()]
      await Promise.all([
        ...[...new Set(
          settingsList
            .map((s) => s?.drive?.cabinet?.ir)
            .filter((x): x is string => !!x),
        )].map((ir) => rack.loadCabinet(ir)),
        ...[...new Set(
          settingsList
            .map((s) => s?.drive?.amp?.model)
            .filter((x): x is string => !!x),
        )].map((m) => rack.loadAmpModel(m)),
      ])

      for (const [role, inst] of loaded) {
        player.registerPart(
          role as BandPart,
          { selector: inst.selector, bank: inst.bank },
          channelSettings.get(role as BandPart),
        )
        // Offline EBU R128 level match; piano was ~6 dB down on the others.
        player.setInstrumentGain(role as BandPart, inst.instrumentGain)
      }
      // A failed IR fetch leaves the dry path untouched, so this never blocks.
      void rack.applyPreset(preset)
      setProgress(null)
      readyRef.current = true
      instrumentsStaleRef.current = false
      loadedStyleRef.current = styleId

      // Same event stream, second sink. Built lazily so users who never touch
      // MIDI pay nothing for it.
      if (midi.enabled && midi.midiOut && !midiSchedRef.current) {
        midiSchedRef.current = new MidiScheduler(ctx, midi.midiOut)
      }
      return player
    } catch (err) {
      console.error(err)
      setLoadError(
        "Instruments failed to load. Run scripts/band_jam_pilot/build_web_samples.py.",
      )
      setStatus("idle")
      setProgress(null)
      return null
    }
  }, [arrangement, styleId, midi.enabled, midi.midiOut])

  useEffect(() => {
    const player = playerRef.current
    // Deliberately NOT gated on instrument-load state: setArrangement only
    // swaps note data, and a part whose instrument is still loading simply
    // stays silent until it arrives.
    if (!player || !arrangement) return
    player.setArrangement(arrangement)
    if (midi.enabled) midiSchedRef.current?.setArrangement(arrangement)
  }, [arrangement, midi.enabled])

  useEffect(() => {
    let raf = 0
    let lastBeat: number | null = null
    const tick = () => {
      const p = playerRef.current
      if (p && p.getStatus() === "playing") {
        setCurrentBar(p.getCurrentBar())
        setBarPhase((p.getCurrentBeat() % 4) / 4)
        // Accumulate elapsed beats. getCurrentBeat wraps at the loop, so count
        // forward deltas only and treat a wrap as a fresh delta rather than a
        // large negative one.
        const b = p.getCurrentBeat()
        if (lastBeat !== null) {
          const d = b - lastBeat
          spanBeatsRef.current += d >= 0 ? d : Math.max(0, b)
        }
        lastBeat = b

        if (rampOn && targetTempo) {
          const next = rampTempo(spanStartTempoRef.current, spanBeatsRef.current, {
            ...DEFAULT_RAMP,
            targetTempo,
          })
          if (next !== p.getTempo()) {
            p.setTempo(next)
            effectsRef.current?.setTempo(next)
            setTempo(next)
          }
        }
      } else {
        lastBeat = null
        setBarPhase(0)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [rampOn, targetTempo])

  useEffect(
    () => () => {
      playerRef.current?.dispose()
      effectsRef.current?.dispose()
      // A hung note on real hardware outlives the page, so always stop the
      // MIDI sink explicitly on unmount.
      midiSchedRef.current?.stop()
    },
    [],
  )

  const handlePlayPause = async () => {
    const player = await ensurePlayer()
    if (!player || !arrangement) return
    if (player.getStatus() === "playing") {
      player.pause()
      midiSchedRef.current?.pause()
      commitSpan()
      return
    }
    player.setArrangement(arrangement)
    player.setTempo(tempo)
    effectsRef.current?.setTempo(tempo)
    player.setLoop(loop)
    player.setCountInBars(countIn ? 1 : 0)
    player.setMetronome(metronome)
    for (const part of ALL_PARTS) {
      player.setMuted(part, mix[part].muted)
      player.setVolume(part, mix[part].volume)
    }
    const ms = midiSchedRef.current
    if (ms && midi.enabled) {
      ms.setArrangement(arrangement)
      ms.setTempo(tempo)
      ms.setLoop(loop)
      ms.setCountInBars(countIn ? 1 : 0)
      for (const part of ALL_PARTS) ms.setPartEnabled(part, !mix[part].muted)
      ms.play()
    }
    await player.play()
  }

  /** Click a chart section → loop only that span and play it from the top. */
  const handlePlaySection = async (section: ArrangementSection) => {
    const range: LoopRange = {
      startBar: section.startBar,
      endBar: section.endBar,
    }
    setLoop(range)

    const player = await ensurePlayer()
    if (!player || !arrangement) return

    const wasPlaying = player.getStatus() === "playing"
    player.setArrangement(arrangement)
    player.setTempo(tempo)
    effectsRef.current?.setTempo(tempo)
    player.setLoop(range)
    player.setCountInBars(countIn ? 1 : 0)
    player.setMetronome(metronome)
    for (const part of ALL_PARTS) {
      player.setMuted(part, mix[part].muted)
      player.setVolume(part, mix[part].volume)
    }
    // Always start the section from bar 1 of that span — setLoop alone only
    // seeks when the playhead is already outside the range.
    player.seekToBar(section.startBar)

    const ms = midiSchedRef.current
    if (ms && midi.enabled) {
      ms.setArrangement(arrangement)
      ms.setTempo(tempo)
      ms.setLoop(range)
      ms.setCountInBars(countIn ? 1 : 0)
      for (const part of ALL_PARTS) ms.setPartEnabled(part, !mix[part].muted)
      ms.seekToBar(section.startBar)
      if (!wasPlaying) void ms.play()
    }
    if (!wasPlaying) await player.play()
  }

  const handleClearLoop = () => {
    setLoop(null)
    playerRef.current?.setLoop(null)
    midiSchedRef.current?.setLoop(null)
  }

  const commitSpan = useCallback(
    (newSession = false) => {
      if (!styleId || !progressionId) return
      const beats = spanBeatsRef.current
      if (beats < 1) return
      practiceRef.current = recordPractice(practiceRef.current, {
        styleId,
        progressionId,
        tempo,
        beatsPlayed: beats,
        targetTempo,
        now: Date.now(),
        newSession,
      })
      savePracticeStore(practiceRef.current)
      spanBeatsRef.current = 0
      spanStartTempoRef.current = tempo
    },
    [styleId, progressionId, tempo, targetTempo],
  )

  // Style change re-voices the whole mix, not just the notes.
  //
  // Keeping sources / partGains / effect chains across a style change caused
  // three separate bugs: rock keys reappearing after visiting funk, the wrong
  // amp sticking when instrument IDs happened to match (funk↔pop guitar), and
  // mid-play style switches scheduling new notes through old samples. Any
  // style change therefore tears the warm session down; the next ensurePlayer
  // rebuilds instruments and every part chain from scratch.
  useEffect(() => {
    const prev = loadedStyleRef.current
    if (!styleId || !prev || prev === styleId) return
    instrumentsStaleRef.current = true
    const player = playerRef.current
    const wasPlaying = player?.getStatus() === "playing"
    if (player && wasPlaying) {
      player.pause()
      midiSchedRef.current?.pause()
      commitSpan()
    }
    if (!wasPlaying || !arrangement) return
    let cancelled = false
    void (async () => {
      const p = await ensurePlayer()
      if (cancelled || !p || !arrangement) return
      p.setArrangement(arrangement)
      p.setTempo(tempo)
      effectsRef.current?.setTempo(tempo)
      p.setLoop(loop)
      p.setCountInBars(countIn ? 1 : 0)
      p.setMetronome(metronome)
      for (const part of ALL_PARTS) {
        p.setMuted(part, mix[part].muted)
        p.setVolume(part, mix[part].volume)
      }
      const ms = midiSchedRef.current
      if (ms && midi.enabled) {
        ms.setArrangement(arrangement)
        ms.setTempo(tempo)
        ms.setLoop(loop)
        ms.setCountInBars(countIn ? 1 : 0)
        for (const part of ALL_PARTS) ms.setPartEnabled(part, !mix[part].muted)
        void ms.play()
      }
      await p.play()
    })()
    return () => {
      cancelled = true
    }
    // Only styleId should retrigger: arrangement/ensurePlayer from this render
    // already belong to the new style. Listing them re-fires on every tempo
    // tweak without changing style.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleId])

  const applyMix = (next: Record<BandPart, PartMixState>) => {
    setMix(next)
    const player = playerRef.current
    if (!player) return
    for (const part of ALL_PARTS) {
      player.setMuted(part, next[part].muted)
      player.setVolume(part, next[part].volume)
    }
  }

  /** Solo mutes everything else without destroying the user's own mute state. */
  const applySolo = (part: BandPart | null) => {
    setSoloed(part)
    const player = playerRef.current
    if (!player) return
    for (const p of ALL_PARTS) {
      const muted = part ? p !== part : (mix[p]?.muted ?? false)
      player.setMuted(p, muted)
    }
  }

  const pickUserPart = (part: BandPart | null) => {
    setUserPart(part)
    const next = { ...mix }
    for (const p of ALL_PARTS) {
      next[p] = { ...next[p], muted: p === part ? true : p === "solo" ? next[p].muted : false }
    }
    if (part) next[part] = { ...next[part], muted: true }
    applyMix(next)
  }

  if (loadError) {
    return (
      <div className="pt-32 pb-16">
        <div className="content-wrap">
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {loadError}
          </p>
        </div>
      </div>
    )
  }

  if (!catalog || !arrangement || !style || !progression) {
    return (
      <div className="pt-32 pb-16">
        <div className="content-wrap">
          <p className="text-sm text-slate-400">Loading catalogue…</p>
        </div>
      </div>
    )
  }

  const transportProps = {
    status,
    tempo,
    tempoMin: style.tempoMin,
    tempoMax: style.tempoMax,
    targetTempo: rampOn ? targetTempo : null,
    keyPc,
    countIn,
    metronome,
    loopActive: loop !== null,
    onPlayPause: handlePlayPause,
    onStop: () => {
      playerRef.current?.stop()
      midiSchedRef.current?.stop()
      commitSpan()
      setCurrentBar(null)
    },
    onTempo: (bpm: number) => {
      setTempo(bpm)
      playerRef.current?.setTempo(bpm)
      midiSchedRef.current?.setTempo(bpm)
      effectsRef.current?.setTempo(bpm)
      spanStartTempoRef.current = bpm
      spanBeatsRef.current = 0
    },
    onTranspose: (semis: number) =>
      setKeyPc((k) => (((k + semis) % 12) + 12) % 12),
    onToggleCountIn: () => setCountIn((v) => !v),
    onToggleMetronome: () => {
      setMetronome((v) => {
        playerRef.current?.setMetronome(!v)
        return !v
      })
    },
    onClearLoop: () => {
      setLoop(null)
      playerRef.current?.setLoop(null)
      midiSchedRef.current?.setLoop(null)
    },
    rampOn,
    onToggleRamp: () => {
      setRampOn((v) => {
        const next = !v
        if (next) {
          spanStartTempoRef.current = tempo
          spanBeatsRef.current = 0
          setTargetTempo((tt) =>
            tt && tt > tempo ? tt : Math.round(tempo * 1.15),
          )
        }
        return next
      })
    },
    onTargetTempo: (bpm: number) => setTargetTempo(Math.round(bpm)),
    standMode,
    onToggleStandMode: () => setStandMode((v) => !v),
    barPhase,
  }

  const mixerProps = {
    parts: activeParts,
    mix,
    userPart,
    onPickUserPart: pickUserPart,
    soloed,
    onToggleSolo: (part: BandPart) => applySolo(soloed === part ? null : part),
    onToggleMute: (part: BandPart) => {
      if (soloed) applySolo(null)
      applyMix({ ...mix, [part]: { ...mix[part], muted: !mix[part].muted } })
    },
    onVolume: (part: BandPart, volume: number) =>
      applyMix({ ...mix, [part]: { ...mix[part], volume } }),
  }

  const setupControls = (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-[10px] tracking-[0.16em] text-white/35 uppercase">
          Style
        </span>
        <select
          value={styleId}
          onChange={(e) => {
            const selectedStyle = catalog.styles.find((x) => x.id === e.target.value)
            setStyleId(e.target.value)
            if (selectedStyle) setTempo(selectedStyle.tempoDefault)
          }}
          className="min-h-11 w-full rounded-xl border border-white/10 bg-[#111] px-3 text-sm text-white outline-none focus:border-orange-400/45"
          aria-label="Style"
        >
          {catalog.styles.map((catalogStyle) => (
            <option key={catalogStyle.id} value={catalogStyle.id}>
              {catalogStyle.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span className="mb-1.5 block text-[10px] tracking-[0.16em] text-white/35 uppercase">
          Progression
        </span>
        <ProgressionPicker
          progressions={catalog.progressions}
          selectedId={progressionId}
          onSelect={(selectedProgression) => {
            setProgressionId(selectedProgression.id)
            setKeyPc(selectedProgression.keyPc)
          }}
          className="w-full"
        />
      </div>
    </div>
  )

  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-40 overflow-hidden bg-[#080808] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_12%,rgba(249,115,22,0.08),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.025),transparent_42%)]" />

      <div className={cn("relative grid h-full", standMode ? "grid-cols-1" : "lg:grid-cols-[288px_minmax(0,1fr)]")}>
        {!standMode ? (
          <aside className="hidden min-h-0 flex-col border-r border-white/10 bg-[#0b0b0b]/95 lg:flex">
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <Link
                href="/jam-player"
                className="mb-6 flex items-center gap-2 text-xs text-white/35 transition hover:text-white/70"
              >
                <ArrowLeft className="size-3.5" />
                Library
              </Link>
              {setupControls}
              <div className="my-5 h-px bg-white/8" />
              <TransportBar {...transportProps} variant="rail" />
            </div>
            <div className="space-y-2 border-t border-white/10 p-4">
              <EffectsControl
                preset={effectsRef.current?.getPreset() ?? presetForStyle(styleId)}
                bypassed={fxBypassed}
                onBypass={(bypassed) => {
                  setFxBypassed(bypassed)
                  effectsRef.current?.setBypass(bypassed)
                }}
                reverbWet={reverbWet}
                onReverbWet={(value) => {
                  setReverbWet(value)
                  effectsRef.current?.setReverbWet(value)
                }}
                parts={activeParts}
                sends={sends}
                onSend={(part, value) => {
                  setSends((current) => ({ ...current, [part]: value }))
                  effectsRef.current?.setReverbSend(part, value)
                }}
                className="w-full"
              />
              <MidiOutControl midi={midi} className="w-full" />
            </div>
          </aside>
        ) : null}

        <main className="flex min-h-0 min-w-0 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/8 px-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-[10px] tracking-[0.16em] text-orange-300/60 uppercase">
                {style.name}
              </p>
              <h1 className="truncate text-base font-medium text-white sm:text-lg">
                {progression.name}
              </h1>
            </div>
            {progress ? (
              <span className="hidden text-xs text-white/30 sm:block">
                Loading {progress.label} · {progress.pct}%
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setMobilePanel("setup")}
                className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-white/55"
                aria-label="Setup"
              >
                <Settings2 className="size-4" />
              </button>
              {!standMode ? (
                <button
                  type="button"
                  onClick={() => setMobilePanel("mix")}
                  className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-white/55"
                  aria-label="Band mixer"
                >
                  <SlidersHorizontal className="size-4" />
                </button>
              ) : null}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
            <div className="mx-auto max-w-6xl">
              <ChordChart
                sections={arrangement.sections}
                currentBar={currentBar}
                barPhase={barPhase}
                loop={loop}
                onLoopSection={(section) => void handlePlaySection(section)}
                onLoopBars={(range) => {
                  if (range === null) {
                    handleClearLoop()
                    return
                  }
                  setLoop(range)
                  playerRef.current?.setLoop(range)
                  playerRef.current?.seekToBar(range.startBar)
                  midiSchedRef.current?.setLoop(range)
                  midiSchedRef.current?.seekToBar(range.startBar)
                }}
              />
            </div>
          </div>

          {!standMode ? (
            <div className="hidden shrink-0 border-t border-white/10 bg-[#090909]/95 px-4 py-3 backdrop-blur lg:block">
              <div className="mx-auto grid max-w-6xl grid-cols-[minmax(280px,0.85fr)_minmax(430px,1.4fr)] gap-3">
                <VariationPicker
                  count={variationCount}
                  value={variation}
                  onChange={setVariation}
                  variant="dock"
                />
                <MixerPanel {...mixerProps} variant="compact" />
              </div>
            </div>
          ) : null}

          {/* Mobile always; desktop only in stand/focus mode so chart+transport
              stay available after the rail (and its Focus toggle) is hidden. */}
          <div
            className={cn(
              "shrink-0 border-t border-white/10 bg-[#090909]/96 p-2",
              standMode ? "block" : "lg:hidden",
            )}
          >
            <TransportBar {...transportProps} />
            {!standMode ? (
              <VariationPicker
                count={variationCount}
                value={variation}
                onChange={setVariation}
                variant="dock"
                className="mt-2"
              />
            ) : null}
          </div>
        </main>
      </div>

      {mobilePanel ? (
        <div className="absolute inset-0 z-50 flex items-end bg-black/65 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setMobilePanel(null)}
            aria-label="Close panel"
          />
          <section className="relative z-10 max-h-[82vh] w-full overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#101010] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium">
                {mobilePanel === "setup" ? "Player setup" : "Band mixer"}
              </h2>
              <button
                type="button"
                onClick={() => setMobilePanel(null)}
                className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-white/50"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            {mobilePanel === "setup" ? (
              <div className="space-y-4">
                {setupControls}
                <EffectsControl
                  preset={effectsRef.current?.getPreset() ?? presetForStyle(styleId)}
                  bypassed={fxBypassed}
                  onBypass={(bypassed) => {
                    setFxBypassed(bypassed)
                    effectsRef.current?.setBypass(bypassed)
                  }}
                  reverbWet={reverbWet}
                  onReverbWet={(value) => {
                    setReverbWet(value)
                    effectsRef.current?.setReverbWet(value)
                  }}
                  parts={activeParts}
                  sends={sends}
                  onSend={(part, value) => {
                    setSends((current) => ({ ...current, [part]: value }))
                    effectsRef.current?.setReverbSend(part, value)
                  }}
                />
                <MidiOutControl midi={midi} />
              </div>
            ) : (
              <MixerPanel {...mixerProps} variant="compact" className="overflow-x-auto" />
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
