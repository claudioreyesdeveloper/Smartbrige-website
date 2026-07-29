"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ListMusic, Settings2, SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ArrangerPanel } from "@/components/band-jam/arranger-panel"
import { ChordChart } from "@/components/band-jam/chord-chart"
import { MixerPanel } from "@/components/band-jam/mixer-panel"
import { TransportBar } from "@/components/band-jam/transport-bar"
import { SongBrowser } from "@/components/band-jam/song-browser"
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
import {
  applyReharmonization,
  ORIGINAL_REHARM_STYLE,
} from "@/lib/band-jam/engine/reharmonization"
import { applyJamPlayerFreeTier } from "@/lib/band-jam/free-tier"
import { BandPlayer } from "@/lib/band-jam/engine/player"
import {
  EffectsRack,
  type PartEffectSettings,
  type UserEqSettings,
} from "@/lib/band-jam/engine/effects"
import {
  presetForStyle,
  resolveChannelEffects,
} from "@/lib/band-jam/engine/effects-presets"
import {
  clearStyleMix,
  loadStyleMixer,
  saveStyleMixer,
  type StyleMixerState,
} from "@/lib/band-jam/engine/style-mix-store"
import {
  applySectionPartPlan,
  buildDefaultStyleArranger,
  isPartDisabledByDefault,
  type SectionPartPlan,
  type StyleArrangerState,
} from "@/lib/band-jam/engine/style-arranger"
import {
  clearStyleArranger,
  loadStyleArranger,
  saveStyleArranger,
} from "@/lib/band-jam/engine/style-arranger-store"
import {
  instrumentForRole,
  loadInstrument,
  loadInstrumentsForRoles,
  ROCK_GUITAR_LAYERS,
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
  SectionRole,
  TransportStatus,
} from "@/lib/band-jam/engine/types"

type ClipJson = Record<string, { sourceKeyPc: number; events: NoteEvent[] }>
type CatalogJson = { progressions: Progression[]; styles: BandStyle[] }

const ALL_PARTS: BandPart[] = ["drums", "bass", "guitar", "keys", "solo"]

/** Styles ear-checked for the first public Jam Player cut. */
const JAM_PLAYER_LAUNCH_STYLE_IDS = ["funk", "rock", "pop", "ballad"] as const

function isPartDisabled(
  part: BandPart,
  styleId: string,
  variation?: number,
  style?: BandStyle | null,
): boolean {
  if (!style || style.id !== styleId || variation === undefined) return false
  return isPartDisabledByDefault(style, variation, part)
}

/**
 * Build the exact arrangement the audio and MIDI transports should play.
 *
 * Keeping this outside React's memo lets a variation button build and install
 * its new clip set during the click itself. Previously the button changed the
 * visible A/B/C/D state first and an effect delivered the new arrangement
 * later, leaving a short but audible window in which a section click could
 * start the previous variation.
 */
function buildPlayableArrangement({
  style,
  progression,
  clips,
  keyPc,
  tempo,
  variation,
  styleId,
  partPlan,
  includeSectionFills = true,
}: {
  style: BandStyle | null
  progression: Progression | null
  clips: Map<number, { events: NoteEvent[]; sourceKeyPc: number }> | null
  keyPc: number
  tempo: number
  variation: number
  styleId: string
  partPlan?: SectionPartPlan | null
  includeSectionFills?: boolean
}): Arrangement | null {
  if (!style || !progression || !clips) return null
  try {
    const out = arrange({
      style,
      progression,
      keyPc,
      tempo,
      clips,
      variation,
      includeSectionFills,
    })
    if (partPlan) return applySectionPartPlan(out, partPlan)
    return {
      ...out,
      parts: out.parts.filter(
        (part) => !isPartDisabled(part.part, styleId, variation, style),
      ),
    }
  } catch (err) {
    console.error("arrange failed", err)
    return null
  }
}

const emptyMix = (): Record<BandPart, PartMixState> => ({
  drums: { volume: 1, muted: false },
  bass: { volume: 1, muted: false },
  guitar: { volume: 0.8, muted: false },
  keys: { volume: 0.75, muted: false },
  solo: { volume: 0.8, muted: true },
})

const flatEq = (): Record<BandPart, UserEqSettings> =>
  Object.fromEntries(
    ALL_PARTS.map((part) => [part, { low: 0, mid: 0, high: 0 }]),
  ) as Record<BandPart, UserEqSettings>

const defaultStyleMixer = (styleId: string): StyleMixerState => {
  const sends = {} as Record<BandPart, number>
  const pan = {} as Record<BandPart, number>
  for (const part of ALL_PARTS) {
    const settings = resolveChannelEffects(
      part,
      instrumentForRole(part, styleId),
      styleId,
    )
    sends[part] = settings.reverbSend ?? 0
    pan[part] = settings.pan ?? 0
  }
  return {
    mix: emptyMix(),
    eq: flatEq(),
    sends,
    pan,
    room: presetForStyle(styleId).reverb.wet,
  }
}

export type PracticeScreenProps = {
  /**
   * From lib/billing/entitlements.ts getJamPlayerEntitlement(), computed
   * server-side in app/jam-player/app/page.tsx.
   *
   * Free (`false`): all four launch styles + complete song catalogue, all practice
   * features, no practice-history persistence, no Web MIDI out.
   * Paid (`true`): practice memory + MIDI.
   * See docs/jam-player-product-plan.md §5 (launch: styles free, breadth gated).
   */
  hasFullAccess?: boolean
}

export function PracticeScreen({ hasFullAccess = false }: PracticeScreenProps = {}) {
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
  const [mobilePanel, setMobilePanel] = useState<"setup" | "mix" | "arrange" | null>(null)
  const [soloed, setSoloed] = useState<BandPart | null>(null)
  const [fxBypassed, setFxBypassed] = useState(false)
  const [reverbWet, setReverbWet] = useState(0.22)
  const [sends, setSends] = useState<Record<BandPart, number>>(
    () => Object.fromEntries(ALL_PARTS.map((part) => [part, 0])) as Record<BandPart, number>,
  )
  const [channelEq, setChannelEq] = useState<Record<BandPart, UserEqSettings>>(flatEq)
  const [channelPan, setChannelPan] = useState<Record<BandPart, number>>(
    () => Object.fromEntries(ALL_PARTS.map((part) => [part, 0])) as Record<BandPart, number>,
  )
  const [mixDirty, setMixDirty] = useState(false)
  const [mixJustSaved, setMixJustSaved] = useState(false)
  const [arrangerState, setArrangerState] = useState<StyleArrangerState | null>(null)
  const [arrangerStyleId, setArrangerStyleId] = useState("")
  const [arrangerDirty, setArrangerDirty] = useState(false)
  const [arrangerJustSaved, setArrangerJustSaved] = useState(false)
  const [targetTempo, setTargetTempo] = useState<number | null>(null)
  const [variation, setVariation] = useState(0)
  const [reharmStyle, setReharmStyle] = useState(ORIGINAL_REHARM_STYLE)
  const [rampOn, setRampOn] = useState(false)

  const practiceRef = useRef<PracticeStore>({})
  /** Beats accumulated since the current span started, for ramp + history. */
  const spanBeatsRef = useRef(0)
  const spanStartBeatRef = useRef(0)
  const spanStartTempoRef = useRef(0)

  const playerRef = useRef<BandPlayer | null>(null)
  const midiSchedRef = useRef<MidiScheduler | null>(null)
  const effectsRef = useRef<EffectsRack | null>(null)
  const mixRef = useRef(mix)
  const eqRef = useRef(channelEq)
  const sendsRef = useRef(sends)
  const panRef = useRef(channelPan)
  const roomRef = useRef(reverbWet)
  const arrangerRef = useRef<StyleArrangerState | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  /** Latest playable data, including a variation installed during its click. */
  const arrangementRef = useRef<Arrangement | null>(null)
  /** Fill-free counterpart used only while a chart section is being auditioned. */
  const sectionArrangementRef = useRef<Arrangement | null>(null)
  const sectionAuditionActiveRef = useRef(false)
  /** Live transport controls read by the single atomic playback transaction. */
  const loopRef = useRef(loop)
  const tempoRef = useRef(tempo)
  const countInRef = useRef(countIn)
  const metronomeRef = useRef(metronome)
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
  /** Invalidates any asynchronous instrument load started by an older style. */
  const instrumentLoadRevisionRef = useRef(0)
  const styleIdRef = useRef(styleId)
  styleIdRef.current = styleId
  loopRef.current = loop
  tempoRef.current = tempo
  countInRef.current = countIn
  metronomeRef.current = metronome

  useEffect(() => {
    // Free tier: all practice features, no saved state (product plan §5).
    practiceRef.current = hasFullAccess ? loadPracticeStore() : {}
  }, [hasFullAccess])

  // Mixer settings belong to one STYLE + VARIATION. A-D can therefore carry
  // genuinely different balances without overwriting one another.
  useEffect(() => {
    if (!styleId) return
    const next = loadStyleMixer(styleId, variation, defaultStyleMixer(styleId))
    setMix(next.mix)
    setChannelEq(next.eq)
    setSends(next.sends)
    setChannelPan(next.pan)
    setReverbWet(next.room)
    mixRef.current = next.mix
    eqRef.current = next.eq
    sendsRef.current = next.sends
    panRef.current = next.pan
    roomRef.current = next.room
    setMixDirty(false)
    setMixJustSaved(false)
    setSoloed(null)
    setUserPart(null)
    const player = playerRef.current
    for (const part of ALL_PARTS) {
      player?.setMuted(part, next.mix[part].muted)
      player?.setVolume(part, next.mix[part].volume)
      effectsRef.current?.setPartUserEq(part, next.eq[part])
      effectsRef.current?.setPartPan(part, next.pan[part])
      effectsRef.current?.setReverbSend(part, next.sends[part])
    }
    effectsRef.current?.setReverbWet(next.room)
  }, [styleId, variation])

  // Web MIDI is the same event stream sent to a real keyboard instead of the
  // browser sampler. Access must be requested from a user gesture. Paid only.
  const midi = useMidiOut()
  const midiLive = hasFullAccess && midi.enabled
  const midiLiveRef = useRef(midiLive)
  midiLiveRef.current = midiLive

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
        // Launch order (ear-checked mix), then free-tier breadth if unpaid.
        const launchStyles = JAM_PLAYER_LAUNCH_STYLE_IDS.map((id) =>
          c.styles.find((s) => s.id === id),
        ).filter((s): s is BandStyle => Boolean(s))
        if (launchStyles.length === 0) {
          setLoadError("No launch styles found in catalogue.")
          return
        }
        const gated = applyJamPlayerFreeTier(
          { styles: launchStyles, progressions: c.progressions },
          hasFullAccess,
        )
        if (gated.styles.length === 0 || gated.progressions.length === 0) {
          setLoadError("Free-tier catalogue is empty.")
          return
        }
        const filtered: CatalogJson = {
          styles: gated.styles,
          progressions: gated.progressions,
        }
        const raw = (clipData.default ?? clipData) as unknown as ClipJson
        const map = new Map<number, { events: NoteEvent[]; sourceKeyPc: number }>()
        for (const [id, v] of Object.entries(raw)) {
          map.set(Number(id), { events: v.events, sourceKeyPc: v.sourceKeyPc })
        }
        setCatalog(filtered)
        setClips(map)
        const firstStyle = filtered.styles[0]
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
  }, [hasFullAccess])

  const style = useMemo(
    () => catalog?.styles.find((s) => s.id === styleId) ?? null,
    [catalog, styleId],
  )
  const progression = useMemo(
    () => catalog?.progressions.find((p) => p.id === progressionId) ?? null,
    [catalog, progressionId],
  )
  const activeProgression = useMemo(
    () =>
      progression
        ? applyReharmonization(progression, reharmStyle)
        : null,
    [progression, reharmStyle],
  )

  const defaultArranger = useMemo(
    () => (style ? buildDefaultStyleArranger(style, 4) : null),
    [style],
  )
  const effectiveArranger =
    arrangerStyleId === styleId && arrangerState
      ? arrangerState
      : defaultArranger

  // Arrangements belong to a style and are remembered only after the user
  // presses the dedicated Save button, matching the full mixer.
  useEffect(() => {
    if (!style || !defaultArranger) return
    const next = loadStyleArranger(style.id, defaultArranger)
    arrangerRef.current = next
    setArrangerState(next)
    setArrangerStyleId(style.id)
    setArrangerDirty(false)
    setArrangerJustSaved(false)
  }, [style, defaultArranger])

  const arrangement: Arrangement | null = useMemo(() => {
    // Tempo is stamped on the arrangement for consumers that read it, but it
    // must NOT be a useMemo dependency: every tempo tick (slider / ramp)
    // rebuilt this object and disturbed live playback.
    return buildPlayableArrangement({
      style,
      progression: activeProgression,
      clips,
      keyPc,
      tempo,
      variation,
      styleId,
      partPlan: effectiveArranger?.[variation],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tempo is live via setTempo
  }, [style, activeProgression, clips, keyPc, variation, styleId, effectiveArranger])

  const sectionArrangement: Arrangement | null = useMemo(() => {
    return buildPlayableArrangement({
      style,
      progression: activeProgression,
      clips,
      keyPc,
      tempo,
      variation,
      styleId,
      partPlan: effectiveArranger?.[variation],
      includeSectionFills: false,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tempo is live via setTempo
  }, [style, activeProgression, clips, keyPc, variation, styleId, effectiveArranger])

  // Event handlers must always see the arrangement represented by the current
  // screen, even before passive effects have run.
  arrangementRef.current = arrangement
  sectionArrangementRef.current = sectionArrangement

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
    const rack = effectsRef.current
    if (rack && readyRef.current) {
      void rack.applyPreset(preset).then(() => {
        rack.setReverbWet(roomRef.current)
        for (const part of ALL_PARTS) {
          rack.setPartUserEq(part, eqRef.current[part])
          rack.setPartPan(part, panRef.current[part])
          rack.setReverbSend(part, sendsRef.current[part])
        }
      })
    }
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
        (p) => arrangement?.parts.some((x) => x.part === p),
      ),
    [arrangement],
  )

  /**
   * Audio starts only on a user gesture — required on iOS.
   *
   * Instrument loading is deliberately completed BEFORE publishing a player
   * into the refs. Older versions published half-built players first, so a
   * slower request for the previous style could finish last and overwrite the
   * newly selected variation with the wrong samples.
   */
  const ensurePlayer = useCallback(async (): Promise<BandPlayer | null> => {
    if (
      playerRef.current &&
      readyRef.current &&
      !instrumentsStaleRef.current &&
      loadedStyleRef.current === styleId
    )
      return playerRef.current
    if (!arrangement) return null

    setStatus("loading")
    try {
      const ctx = ctxRef.current ?? new AudioContext()
      ctxRef.current = ctx

      const requestedStyleId = styleId
      const loadRevision = instrumentLoadRevisionRef.current

      // Load every instrument the style offers, even when the current
      // section plan starts with that part silent. The Arranger can bring it
      // in live later; waiting until then would leave the newly enabled notes
      // without a registered sound source.
      const roles = ALL_PARTS.filter((part) => Boolean(style?.parts[part]))
      const loaded = await loadInstrumentsForRoles(ctx, roles, {
        styleId: requestedStyleId,
        onProgress: (id, done, total) =>
          setProgress({
            label: id,
            pct: total ? Math.round((done / total) * 100) : 0,
          }),
      })

      // Rock gets a real double-track rather than a chorus imitation. Load
      // SolidGuitar2 alongside the normal Emily source; both later receive
      // the same notes through independent amp/cabinet chains.
      const rockSolidGuitar =
        requestedStyleId === "rock" && loaded.has("guitar")
          ? await loadInstrument(ctx, ROCK_GUITAR_LAYERS[1].id, {
              onProgress: (done, total) =>
                setProgress({
                  label: ROCK_GUITAR_LAYERS[1].id,
                  pct: total ? Math.round((done / total) * 100) : 0,
                }),
            })
          : null
      if (
        loadRevision !== instrumentLoadRevisionRef.current ||
        requestedStyleId !== styleIdRef.current
      ) {
        return null
      }

      // Publish only a fully resolved generation. This makes style + samples
      // + effects one unanimous pass, rather than three independently racing
      // updates.
      const rack = new EffectsRack(ctx)
      const player = new BandPlayer(ctx, { onStatus: setStatus, effects: rack })
      const preset = presetForStyle(requestedStyleId)

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
            instrumentForRole(role, requestedStyleId),
            requestedStyleId,
          ),
        )
      }
      const rockSolidSettings = rockSolidGuitar
        ? {
            ...resolveChannelEffects(
              "guitar",
              ROCK_GUITAR_LAYERS[1].id,
              requestedStyleId,
            ),
            trim: ROCK_GUITAR_LAYERS[1].trim,
          }
        : undefined

      // Cabinet IRs and amp models must both be cached BEFORE the part chains
      // are built, because createPartChain reads them synchronously and
      // silently falls back when one is missing.
      const settingsList = [
        ...channelSettings.values(),
        ...(rockSolidSettings ? [rockSolidSettings] : []),
      ]
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
        const part = role as BandPart
        if (part === "guitar" && rockSolidGuitar && rockSolidSettings) {
          const emilyLayer = ROCK_GUITAR_LAYERS[0]
          const solidLayer = ROCK_GUITAR_LAYERS[1]
          player.registerPartLayer(
            part,
            emilyLayer.layerId,
            { selector: inst.selector, bank: inst.bank },
            {
              settings: {
                ...channelSettings.get(part),
                trim: emilyLayer.trim,
              },
              pan: emilyLayer.pan,
              instrumentGain: inst.instrumentGain,
            },
          )
          player.registerPartLayer(
            part,
            solidLayer.layerId,
            { selector: rockSolidGuitar.selector, bank: rockSolidGuitar.bank },
            {
              settings: rockSolidSettings,
              pan: solidLayer.pan,
              instrumentGain: rockSolidGuitar.instrumentGain,
            },
          )
        } else {
          player.registerPart(
            part,
            { selector: inst.selector, bank: inst.bank },
            channelSettings.get(part),
          )
          // Offline EBU R128 level match; piano was ~6 dB down on the others.
          player.setInstrumentGain(part, inst.instrumentGain)
        }
        rack.setPartUserEq(part, eqRef.current[part])
        rack.setPartPan(part, panRef.current[part])
        rack.setReverbSend(part, sendsRef.current[part])
      }
      playerRef.current = player
      effectsRef.current = rack
      // A failed IR fetch leaves the dry path untouched, so this never blocks.
      void rack.applyPreset(preset).then(() => {
        rack.setReverbWet(roomRef.current)
        for (const part of ALL_PARTS) {
          rack.setReverbSend(part, sendsRef.current[part])
        }
      })
      setProgress(null)
      readyRef.current = true
      instrumentsStaleRef.current = false
      loadedStyleRef.current = requestedStyleId

      // Same event stream, second sink. Built lazily so users who never touch
      // MIDI pay nothing for it.
      if (midiLive && midi.midiOut && !midiSchedRef.current) {
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
  }, [arrangement, styleId, style, midiLive, midi.midiOut])

  /**
   * Commit one complete playback pass to both audio and MIDI.
   *
   * No caller may update arrangement, loop, seek and resume independently.
   * Keeping these operations together prevents a previous variation's async
   * work from landing between the seek and play calls of the current one.
   */
  const installPlaybackPass = useCallback((
    playable: Arrangement,
    options: { startBar?: number; resume: boolean; range: LoopRange | null },
  ) => {
    const player = playerRef.current
    if (!player) return

    const liveTempo = tempoRef.current
    const liveCountIn = countInRef.current
    const liveMetronome = metronomeRef.current
    const liveMidi = midiLiveRef.current

    player.pause()
    midiSchedRef.current?.pause()
    player.setArrangement(playable)
    player.setTempo(liveTempo)
    effectsRef.current?.setTempo(liveTempo)
    player.setLoop(options.range)
    player.setCountInBars(liveCountIn ? 1 : 0)
    player.setMetronome(liveMetronome)
    for (const part of ALL_PARTS) {
      player.setMuted(part, mixRef.current[part].muted)
      player.setVolume(part, mixRef.current[part].volume)
    }
    if (options.startBar !== undefined) player.seekToBar(options.startBar)

    const ms = midiSchedRef.current
    if (ms && liveMidi) {
      ms.setArrangement(playable)
      ms.setTempo(liveTempo)
      ms.setLoop(options.range)
      ms.setCountInBars(liveCountIn ? 1 : 0)
      for (const part of ALL_PARTS) {
        ms.setPartEnabled(part, !mixRef.current[part].muted)
      }
      if (options.startBar !== undefined) ms.seekToBar(options.startBar)
      if (options.resume) void ms.play()
    }
    if (options.resume) void player.play()
  }, [])

  // Song/key/reharmonization/Arranger/variation changes all arrive here and
  // nowhere else. Restart at the beginning of the active section, matching
  // the desktop Jam Player instead of preserving a random beat in its middle.
  useEffect(() => {
    const player = playerRef.current
    if (!player || !arrangement) return
    const playable = sectionAuditionActiveRef.current
      ? (sectionArrangement ?? arrangement)
      : arrangement
    const wasPlaying = player.getStatus() === "playing"
    const oldBar = player.getCurrentBar()
    const currentSection = playable.sections.find(
      (section) => oldBar >= section.startBar && oldBar <= section.endBar,
    )
    const activeLoop = loopRef.current
    const startBar = activeLoop?.startBar ?? currentSection?.startBar ?? 1
    installPlaybackPass(playable, {
      startBar,
      resume: wasPlaying,
      range: activeLoop,
    })
  }, [arrangement, sectionArrangement, installPlaybackPass])

  /** A/B/C/D is state only; the single playback-pass effect installs it. */
  const handleVariationChange = (nextVariation: number) => {
    if (nextVariation === variation) return
    setVariation(nextVariation)
  }

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
    const playableArrangement =
      (sectionAuditionActiveRef.current
        ? sectionArrangementRef.current
        : arrangementRef.current) ?? arrangement
    if (!player || !playableArrangement) return
    if (player.getStatus() === "playing") {
      player.pause()
      midiSchedRef.current?.pause()
      commitSpan()
      return
    }
    installPlaybackPass(playableArrangement, {
      resume: true,
      range: loopRef.current,
    })
  }

  /** Click a chart section → loop only that span and play it from the top. */
  const handlePlaySection = async (section: ArrangementSection) => {
    const range: LoopRange = {
      startBar: section.startBar,
      endBar: section.endBar,
    }
    setLoop(range)
    sectionAuditionActiveRef.current = true

    const player = await ensurePlayer()
    const playableArrangement =
      sectionArrangementRef.current ?? sectionArrangement ?? arrangement
    if (!player || !playableArrangement) return
    installPlaybackPass(playableArrangement, {
      startBar: section.startBar,
      resume: true,
      range,
    })
  }

  /** Drag/select a bar range → the same atomic pass as a named section. */
  const handleLoopBars = async (range: LoopRange) => {
    setLoop(range)
    sectionAuditionActiveRef.current = true
    const player = await ensurePlayer()
    const playableArrangement =
      sectionArrangementRef.current ?? sectionArrangement ?? arrangement
    if (!player || !playableArrangement) return
    installPlaybackPass(playableArrangement, {
      startBar: range.startBar,
      resume: player.getStatus() === "playing",
      range,
    })
  }

  const handleClearLoop = () => {
    sectionAuditionActiveRef.current = false
    setLoop(null)
    const fullArrangement = arrangementRef.current ?? arrangement
    const player = playerRef.current
    if (fullArrangement && player) {
      const wasPlaying = player.getStatus() === "playing"
      const oldBar = player.getCurrentBar()
      const currentSection = fullArrangement.sections.find(
        (section) => oldBar >= section.startBar && oldBar <= section.endBar,
      )
      installPlaybackPass(fullArrangement, {
        startBar: currentSection?.startBar ?? 1,
        resume: wasPlaying,
        range: null,
      })
    }
  }

  const commitSpan = useCallback(
    (newSession = false) => {
      if (!hasFullAccess) return
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
    [hasFullAccess, styleId, progressionId, tempo, targetTempo],
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
    instrumentLoadRevisionRef.current += 1
    const prev = loadedStyleRef.current
    if (!styleId || !prev || prev === styleId) return
    instrumentsStaleRef.current = true
    const player = playerRef.current
    if (player?.getStatus() === "playing") commitSpan()
    player?.dispose()
    effectsRef.current?.dispose()
    midiSchedRef.current?.stop()
    playerRef.current = null
    effectsRef.current = null
    midiSchedRef.current = null
    readyRef.current = false
    loadedStyleRef.current = null
    setProgress(null)
    setStatus("idle")
    // A style is a new desktop-style playback session. It deliberately waits
    // for the next Play gesture rather than auto-starting through whatever
    // samples happen to finish loading first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleId])

  const applyMix = (next: Record<BandPart, PartMixState>) => {
    setMix(next)
    mixRef.current = next
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
    onClearLoop: handleClearLoop,
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

  const markMixDirty = () => {
    setMixDirty(true)
    setMixJustSaved(false)
  }

  const changeSend = (part: BandPart, value: number) => {
    const next = { ...sendsRef.current, [part]: value }
    sendsRef.current = next
    setSends(next)
    effectsRef.current?.setReverbSend(part, value)
    markMixDirty()
  }

  const arrangerParts = ALL_PARTS.filter((part) => Boolean(style.parts[part]))

  const updateArranger = (
    updater: (state: StyleArrangerState) => StyleArrangerState,
  ) => {
    if (!effectiveArranger) return
    const next = updater(effectiveArranger)
    arrangerRef.current = next
    setArrangerState(next)
    setArrangerStyleId(styleId)
    setArrangerDirty(true)
    setArrangerJustSaved(false)
  }

  const arrangerProps = effectiveArranger
    ? {
        styleLabel: style.name,
        parts: arrangerParts,
        variationCount,
        variation,
        state: effectiveArranger,
        onVariation: handleVariationChange,
        onToggle: (
          targetVariation: number,
          role: SectionRole,
          part: BandPart,
        ) =>
          updateArranger((current) =>
            current.map((plan, index) =>
              index !== targetVariation
                ? plan
                : {
                    ...plan,
                    [role]: {
                      ...plan[role],
                      [part]: !plan[role][part],
                    },
                  },
            ),
          ),
        onSection: (
          targetVariation: number,
          role: SectionRole,
          enabled: boolean,
        ) =>
          updateArranger((current) =>
            current.map((plan, index) =>
              index !== targetVariation
                ? plan
                : {
                    ...plan,
                    [role]: {
                      ...plan[role],
                      ...Object.fromEntries(
                        arrangerParts.map((part) => [part, enabled]),
                      ),
                    },
                  },
            ),
          ),
        onSave: () => {
          saveStyleArranger(styleId, arrangerRef.current ?? effectiveArranger)
          setArrangerDirty(false)
          setArrangerJustSaved(true)
          window.setTimeout(() => setArrangerJustSaved(false), 1800)
        },
        onReset: () => {
          clearStyleArranger(styleId)
          if (!defaultArranger) return
          arrangerRef.current = defaultArranger
          setArrangerState(defaultArranger)
          setArrangerStyleId(styleId)
          setArrangerDirty(false)
          setArrangerJustSaved(false)
        },
        isDirty: arrangerDirty,
        justSaved: arrangerJustSaved,
      }
    : null

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
    onVolume: (part: BandPart, volume: number) => {
      const next = { ...mix, [part]: { ...mix[part], volume } }
      applyMix(next)
      markMixDirty()
    },
    eq: channelEq,
    onEq: (part: BandPart, band: keyof UserEqSettings, value: number) => {
      const next = {
        ...eqRef.current,
        [part]: { ...eqRef.current[part], [band]: value },
      }
      eqRef.current = next
      setChannelEq(next)
      effectsRef.current?.setPartUserEq(part, next[part])
      markMixDirty()
    },
    sends,
    onSend: changeSend,
    pan: channelPan,
    onPan: (part: BandPart, value: number) => {
      const next = { ...panRef.current, [part]: value }
      panRef.current = next
      setChannelPan(next)
      effectsRef.current?.setPartPan(part, value)
      markMixDirty()
    },
    room: reverbWet,
    onRoom: (value: number) => {
      roomRef.current = value
      setReverbWet(value)
      effectsRef.current?.setReverbWet(value)
      markMixDirty()
    },
    styleLabel: `${style.name} · Variation ${String.fromCharCode(65 + variation)}`,
    isDirty: mixDirty,
    justSaved: mixJustSaved,
    onSave: () => {
      saveStyleMixer(styleId, variation, {
        mix: mixRef.current,
        eq: eqRef.current,
        sends: sendsRef.current,
        pan: panRef.current,
        room: roomRef.current,
      })
      setMixDirty(false)
      setMixJustSaved(true)
      window.setTimeout(() => setMixJustSaved(false), 1800)
    },
    onReset: () => {
      clearStyleMix(styleId, variation)
      const next = defaultStyleMixer(styleId)
      applyMix(next.mix)
      eqRef.current = next.eq
      sendsRef.current = next.sends
      panRef.current = next.pan
      roomRef.current = next.room
      setChannelEq(next.eq)
      setSends(next.sends)
      setChannelPan(next.pan)
      setReverbWet(next.room)
      for (const part of ALL_PARTS) {
        effectsRef.current?.setPartUserEq(part, next.eq[part])
        effectsRef.current?.setPartPan(part, next.pan[part])
        effectsRef.current?.setReverbSend(part, next.sends[part])
      }
      effectsRef.current?.setReverbWet(next.room)
      setMixDirty(false)
      setMixJustSaved(false)
    },
  }

  const selectProgression = (selectedProgression: Progression) => {
    setProgressionId(selectedProgression.id)
    setKeyPc(selectedProgression.keyPc)
    setReharmStyle(ORIGINAL_REHARM_STYLE)
  }

  const setupControls = (
    <div className="space-y-3">
      <SongBrowser
        progressions={catalog.progressions}
        selectedId={progressionId}
        onSelect={selectProgression}
      />
      <div className="my-4 h-px bg-white/8" />
      <label className="block">
        <span className="mb-1.5 block text-[10px] tracking-[0.16em] text-white/35 uppercase">
          Band Style
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
      {progression?.reharmStyles?.length ? (
        <label className="block">
          <span className="mb-1.5 block text-[10px] tracking-[0.16em] text-white/35 uppercase">
            Reharmonization
          </span>
          <select
            value={reharmStyle}
            onChange={(event) => setReharmStyle(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-white/10 bg-[#111] px-3 text-sm text-white outline-none focus:border-orange-400/45"
            aria-label="Reharmonization"
          >
            <option value={ORIGINAL_REHARM_STYLE}>Original</option>
            {progression.reharmStyles.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-[10px] leading-relaxed text-white/30">
            Changes the chords only. The selected A–D performance stays the same.
          </span>
        </label>
      ) : null}
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
              {!hasFullAccess ? (
                <p className="mb-4 rounded-xl border border-orange-400/20 bg-orange-400/5 px-3 py-2 text-[11px] leading-relaxed text-orange-100/70">
                  Free pack: funk, pop, rock, ballad · full song catalogue.{" "}
                  <Link
                    href="/sign-in?redirect_url=/jam-player/app"
                    className="text-orange-300 underline-offset-2 hover:underline"
                  >
                    Sign in
                  </Link>{" "}
                  for practice memory and MIDI out.
                </p>
              ) : null}
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
                  roomRef.current = value
                  setReverbWet(value)
                  effectsRef.current?.setReverbWet(value)
                  markMixDirty()
                }}
                parts={activeParts}
                sends={sends}
                onSend={changeSend}
                className="w-full"
              />
              {hasFullAccess ? (
                <MidiOutControl midi={midi} className="w-full" />
              ) : (
                <p className="text-[10px] leading-relaxed text-white/30">
                  MIDI out unlocks with Jam Player.
                </p>
              )}
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
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobilePanel("setup")}
                className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-white/55 lg:hidden"
                aria-label="Setup"
              >
                <Settings2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setMobilePanel("arrange")}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-sky-300/20 bg-sky-400/[0.05] px-3 text-white/65 transition hover:bg-sky-400/10 hover:text-white"
                aria-label="Open full arranger"
              >
                <ListMusic className="size-4" />
                <span className="hidden text-xs lg:inline">Arranger</span>
              </button>
              <button
                type="button"
                onClick={() => setMobilePanel("mix")}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-orange-300/25 bg-orange-400/[0.06] px-3 text-white/65 transition hover:bg-orange-400/10 hover:text-white"
                aria-label="Open full mixer"
              >
                <SlidersHorizontal className="size-4" />
                <span className="hidden text-xs lg:inline">Mixer</span>
              </button>
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
                  void handleLoopBars(range)
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
                  onChange={handleVariationChange}
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
                onChange={handleVariationChange}
                variant="dock"
                className="mt-2"
              />
            ) : null}
          </div>
        </main>
      </div>

      {mobilePanel ? (
        <div className="absolute inset-0 z-50 flex items-end bg-black/65 backdrop-blur-sm lg:items-center lg:justify-center lg:p-6">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setMobilePanel(null)}
            aria-label="Close panel"
          />
          <section className="relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#101010] p-4 shadow-2xl lg:max-w-6xl lg:rounded-3xl lg:border">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium">
                {mobilePanel === "setup"
                  ? "Player setup"
                  : mobilePanel === "arrange"
                    ? "Full arranger"
                    : "Full mixer"}
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
                {!hasFullAccess ? (
                  <p className="rounded-xl border border-orange-400/20 bg-orange-400/5 px-3 py-2 text-[11px] leading-relaxed text-orange-100/70">
                    Free pack: funk, pop, rock, ballad · full song catalogue.{" "}
                    <Link
                      href="/sign-in?redirect_url=/jam-player/app"
                      className="text-orange-300 underline-offset-2 hover:underline"
                    >
                      Sign in
                    </Link>{" "}
                    for practice memory and MIDI out.
                  </p>
                ) : null}
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
                    roomRef.current = value
                    setReverbWet(value)
                    effectsRef.current?.setReverbWet(value)
                    markMixDirty()
                  }}
                  parts={activeParts}
                  sends={sends}
                  onSend={changeSend}
                />
                {hasFullAccess ? (
                  <MidiOutControl midi={midi} />
                ) : (
                  <p className="text-[10px] leading-relaxed text-white/30">
                    MIDI out unlocks with Jam Player.
                  </p>
                )}
              </div>
            ) : mobilePanel === "arrange" ? (
              arrangerProps ? <ArrangerPanel {...arrangerProps} /> : null
            ) : (
              <MixerPanel {...mixerProps} variant="full" />
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
