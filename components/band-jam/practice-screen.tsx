"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ListMusic, Settings2, SlidersHorizontal } from "lucide-react"
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
import { PlayerPanelDialog } from "@/components/band-jam/player-panel-dialog"
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
import { JamPlayerController } from "@/lib/band-jam/engine/jam-player-controller"
import { elapsedBeatsForAudioTime } from "@/lib/band-jam/engine/playback-state"
import { InstrumentRepository } from "@/lib/band-jam/engine/instrument-repository"
import { validateJamPlayerCatalog } from "@/lib/band-jam/engine/catalog-integrity"
import {
  clearJamPlayerCatalogCaches,
  loadJamPlayerCatalogIndex,
  loadJamPlayerProgression,
  loadJamPlayerStyleClips,
  type JamPlayerCatalogIndex,
} from "@/lib/band-jam/catalog-loader"
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
type ArrangementBuildResult = {
  arrangement: Arrangement | null
  error: string | null
}

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
}): ArrangementBuildResult {
  if (!style || !progression || !clips) {
    return { arrangement: null, error: null }
  }
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
    const arrangement = partPlan
      ? applySectionPartPlan(out, partPlan)
      : {
          ...out,
          parts: out.parts.filter(
            (part) => !isPartDisabled(part.part, styleId, variation, style),
          ),
        }
    return { arrangement, error: null }
  } catch (err) {
    console.error("arrange failed", err)
    return {
      arrangement: null,
      error: "This arrangement could not be built. Try another song or style.",
    }
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
  const [catalog, setCatalog] = useState<JamPlayerCatalogIndex | null>(null)
  const [loadedProgression, setLoadedProgression] = useState<Progression | null>(null)
  const [clips, setClips] = useState<Map<number, { events: NoteEvent[]; sourceKeyPc: number }> | null>(null)
  const [loadError, setLoadError] = useState("")
  const [styleLoadError, setStyleLoadError] = useState("")
  const [progressionLoadError, setProgressionLoadError] = useState("")
  const [dataReloadRevision, setDataReloadRevision] = useState(0)
  const [instrumentError, setInstrumentError] = useState("")
  const [instrumentWarning, setInstrumentWarning] = useState("")
  const [progress, setProgress] = useState<number | null>(null)

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
  const spanStartTempoRef = useRef(0)

  const controllerRef = useRef<JamPlayerController | null>(null)
  if (!controllerRef.current) controllerRef.current = new JamPlayerController()
  const instrumentRepositoryRef = useRef<InstrumentRepository | null>(null)
  const playerLoadRef = useRef<Promise<BandPlayer | null> | null>(null)
  const mixRef = useRef(mix)
  const eqRef = useRef(channelEq)
  const sendsRef = useRef(sends)
  const panRef = useRef(channelPan)
  const roomRef = useRef(reverbWet)
  const arrangerRef = useRef<StyleArrangerState | null>(null)
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
    const controller = controllerRef.current
    controller?.setMix(next.mix)
    controller?.setSoloed(null)
    const rack = controller?.getEffects()
    for (const part of ALL_PARTS) {
      rack?.setPartUserEq(part, next.eq[part])
      rack?.setPartPan(part, next.pan[part])
      rack?.setReverbSend(part, next.sends[part])
    }
    rack?.setReverbWet(next.room)
  }, [styleId, variation])

  // Web MIDI is the same event stream sent to a real keyboard instead of the
  // browser sampler. Access must be requested from a user gesture. Paid only.
  const midi = useMidiOut()
  const midiLive = hasFullAccess && midi.enabled

  // Load a small searchable index first. Full chord sections and style clips
  // arrive only for the selected song/style, avoiding the previous ~9.7 MB
  // parse before the first note could play.
  useEffect(() => {
    let cancelled = false
    setCatalog(null)
    setClips(null)
    setLoadedProgression(null)
    setLoadError("")
    setStyleLoadError("")
    setProgressionLoadError("")
    ;(async () => {
      try {
        const index = await loadJamPlayerCatalogIndex()
        if (cancelled) return
        const launchStyles = JAM_PLAYER_LAUNCH_STYLE_IDS.map((id) =>
          index.styles.find((candidate) => candidate.id === id),
        ).filter((candidate): candidate is BandStyle => Boolean(candidate))
        if (launchStyles.length === 0) {
          setLoadError("No launch styles found in catalogue.")
          return
        }
        const gated = applyJamPlayerFreeTier(
          { styles: launchStyles, progressions: index.progressions },
          hasFullAccess,
        )
        if (gated.styles.length === 0 || gated.progressions.length === 0) {
          setLoadError("The Jam Player catalogue is empty.")
          return
        }
        const filtered: JamPlayerCatalogIndex = {
          ...index,
          styles: gated.styles,
          progressions: gated.progressions,
        }
        setLoadError("")
        setCatalog(filtered)
        const firstStyle = filtered.styles[0]
        const firstProgression = filtered.progressions[0]
        if (firstStyle) {
          setStyleId(firstStyle.id)
          setTempo(firstStyle.tempoDefault)
        }
        if (firstProgression) {
          setProgressionId(firstProgression.id)
          setKeyPc(firstProgression.keyPc)
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            "The Jam Player catalogue could not be loaded. Check the connection and try again.",
          )
          console.error(err)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasFullAccess, dataReloadRevision])

  useEffect(() => {
    if (!catalog || !styleId) return
    let cancelled = false
    setClips(null)
    setStyleLoadError("")
    ;(async () => {
      try {
        const nextClips = await loadJamPlayerStyleClips(catalog, styleId)
        if (cancelled) return
        const selectedStyle = catalog.styles.find((candidate) => candidate.id === styleId)
        const issues = selectedStyle
          ? validateJamPlayerCatalog([selectedStyle], [], nextClips)
          : []
        if (issues.length > 0) {
          console.error("Jam Player style shard integrity failed", issues)
          setStyleLoadError(
            "The selected Jam Player style is incomplete. Please refresh after the content update finishes.",
          )
          return
        }
        setStyleLoadError("")
        setClips(nextClips)
      } catch (err) {
        if (!cancelled) {
          setStyleLoadError(
            "The selected Jam Player style could not be loaded. Check the connection and try again.",
          )
          console.error(err)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [catalog, styleId, dataReloadRevision])

  useEffect(() => {
    if (!catalog || !progressionId) return
    let cancelled = false
    setLoadedProgression(null)
    setProgressionLoadError("")
    ;(async () => {
      try {
        const nextProgression = await loadJamPlayerProgression(
          catalog,
          progressionId,
        )
        if (cancelled) return
        if (nextProgression.sections.length === 0) {
          setProgressionLoadError("The selected song does not contain any playable sections.")
          return
        }
        setProgressionLoadError("")
        setLoadedProgression(nextProgression)
      } catch (err) {
        if (!cancelled) {
          setProgressionLoadError(
            "The selected Jam Player song could not be loaded. Check the connection and try again.",
          )
          console.error(err)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [catalog, progressionId, dataReloadRevision])

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
      loadedProgression
        ? applyReharmonization(loadedProgression, reharmStyle)
        : null,
    [loadedProgression, reharmStyle],
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

  const arrangementBuild = useMemo(() => {
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
  const arrangement = arrangementBuild.arrangement

  const sectionArrangementBuild = useMemo(() => {
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
  const sectionArrangement = sectionArrangementBuild.arrangement
  const arrangementError = arrangementBuild.error ?? sectionArrangementBuild.error

  // Event handlers must always see the arrangement represented by the current
  // screen, even before passive effects have run.
  arrangementRef.current = arrangement
  sectionArrangementRef.current = sectionArrangement

  // MIDI may be enabled after the browser sampler is already warm. Attach the
  // second sink immediately and align it at the current bar instead of waiting
  // for an unrelated style reload.
  useEffect(() => {
    const controller = controllerRef.current
    if (!controller) return
    if (!midiLive) {
      controller.attachMidi(null)
      return
    }
    const ctx = controller.getContext()
    const player = controller.getPlayer()
    if (!ctx || !player || controller.getMidiScheduler()) return
    controller.attachMidi(new MidiScheduler(ctx, midi.midiOut))
    const playable = sectionAuditionActiveRef.current
      ? sectionArrangementRef.current
      : arrangementRef.current
    if (!playable) return
    controller.installPlaybackPass(playable, {
      startBar: player.getCurrentBar(),
      resume: player.getStatus() === "playing",
      range: loopRef.current,
      tempo: tempoRef.current,
      countIn: countInRef.current,
      metronome: metronomeRef.current,
    })
  }, [midiLive, midi.midiOut])

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
    const rack = controllerRef.current?.getEffects()
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
  const loadPlayer = useCallback(async (): Promise<BandPlayer | null> => {
    const controller = controllerRef.current!
    const currentPlayer = controller.getPlayer()
    if (
      currentPlayer &&
      readyRef.current &&
      !instrumentsStaleRef.current &&
      loadedStyleRef.current === styleId
    ) {
      const ctx = controller.getContext()
      if (ctx && midiLive && midi.midiOut && !controller.getMidiScheduler()) {
        controller.attachMidi(new MidiScheduler(ctx, midi.midiOut))
      } else if (!midiLive && controller.getMidiScheduler()) {
        controller.attachMidi(null)
      }
      return currentPlayer
    }
    if (!arrangement) return null

    setStatus("loading")
    setInstrumentError("")
    setInstrumentWarning("")
    let createdContext: AudioContext | null = null
    let attemptedRepository: InstrumentRepository | null = null
    let candidatePlayer: BandPlayer | null = null
    let candidateRack: EffectsRack | null = null
    const discardCandidate = () => {
      candidatePlayer?.dispose()
      candidateRack?.dispose()
      candidatePlayer = null
      candidateRack = null
      if (createdContext) {
        attemptedRepository?.clear()
        if (instrumentRepositoryRef.current === attemptedRepository) {
          instrumentRepositoryRef.current = null
        }
        const abandoned = createdContext
        createdContext = null
        if (abandoned.state !== "closed") {
          void abandoned.close().catch((error) => {
            console.error("Abandoned AudioContext close failed", error)
          })
        }
      }
    }
    try {
      const existingContext = controller.getContext()
      const ctx = existingContext ?? (createdContext = new AudioContext())
      let repository = instrumentRepositoryRef.current
      if (!repository || controller.getContext() !== ctx) {
        repository = new InstrumentRepository(ctx)
        instrumentRepositoryRef.current = repository
      }
      attemptedRepository = repository

      const requestedStyleId = styleId
      const loadRevision = instrumentLoadRevisionRef.current
      const roles = ALL_PARTS.filter((part) => Boolean(style?.parts[part]))
      const expectedInstrumentIds = [...new Set([
        ...roles
          .map((role) => instrumentForRole(role, requestedStyleId))
          .filter((id): id is string => Boolean(id)),
        ...(requestedStyleId === "rock" ? [ROCK_GUITAR_LAYERS[1].id] : []),
      ])]
      const loadedFractions = new Map(
        expectedInstrumentIds.map((id) => [id, 0]),
      )
      const reportInstrumentProgress = (
        instrumentId: string,
        done: number,
        total: number,
      ) => {
        loadedFractions.set(
          instrumentId,
          total > 0 ? Math.max(0, Math.min(1, done / total)) : 0,
        )
        const overall = loadedFractions.size
          ? [...loadedFractions.values()].reduce((sum, value) => sum + value, 0)
              / loadedFractions.size
          : 0
        setProgress(Math.round(overall * 100))
      }

      const loaded = await repository.loadRoles(roles, {
        styleId: requestedStyleId,
        onInstrumentProgress: reportInstrumentProgress,
      })
      const rockSolidGuitar =
        requestedStyleId === "rock" && loaded.has("guitar")
          ? await repository.load(ROCK_GUITAR_LAYERS[1].id, {
              onProgress: (done, total) =>
                reportInstrumentProgress(
                  ROCK_GUITAR_LAYERS[1].id,
                  done,
                  total,
                ),
            })
          : null

      if (
        loadRevision !== instrumentLoadRevisionRef.current ||
        requestedStyleId !== styleIdRef.current
      ) {
        discardCandidate()
        return null
      }

      const rack = new EffectsRack(ctx)
      const player = new BandPlayer(ctx, { onStatus: setStatus, effects: rack })
      candidateRack = rack
      candidatePlayer = player
      const preset = presetForStyle(requestedStyleId)
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

      const settingsList = [
        ...channelSettings.values(),
        ...(rockSolidSettings ? [rockSolidSettings] : []),
      ]
      await Promise.all([
        ...[...new Set(
          settingsList
            .map((settings) => settings?.drive?.cabinet?.ir)
            .filter((value): value is string => Boolean(value)),
        )].map((ir) => rack.loadCabinet(ir)),
        ...[...new Set(
          settingsList
            .map((settings) => settings?.drive?.amp?.model)
            .filter((value): value is string => Boolean(value)),
        )].map((model) => rack.loadAmpModel(model)),
      ])

      if (
        loadRevision !== instrumentLoadRevisionRef.current ||
        requestedStyleId !== styleIdRef.current
      ) {
        discardCandidate()
        return null
      }

      for (const [role, instrument] of loaded) {
        const part = role as BandPart
        if (part === "guitar" && rockSolidGuitar && rockSolidSettings) {
          const emilyLayer = ROCK_GUITAR_LAYERS[0]
          const solidLayer = ROCK_GUITAR_LAYERS[1]
          player.registerPartLayer(
            part,
            emilyLayer.layerId,
            { selector: instrument.selector, bank: instrument.bank },
            {
              settings: {
                ...channelSettings.get(part),
                trim: emilyLayer.trim,
              },
              pan: emilyLayer.pan,
              instrumentGain: instrument.instrumentGain,
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
            { selector: instrument.selector, bank: instrument.bank },
            channelSettings.get(part),
          )
          player.setInstrumentGain(part, instrument.instrumentGain)
        }
        rack.setPartUserEq(part, eqRef.current[part])
        rack.setPartPan(part, panRef.current[part])
        rack.setReverbSend(part, sendsRef.current[part])
      }

      controller.attachAudio(ctx, player, rack)
      candidatePlayer = null
      candidateRack = null
      createdContext = null
      controller.setMix(mixRef.current)
      controller.setSoloed(soloed)
      if (midiLive && midi.midiOut) {
        controller.attachMidi(new MidiScheduler(ctx, midi.midiOut))
      }

      void rack.applyPreset(preset).then(() => {
        rack.setReverbWet(roomRef.current)
        for (const part of ALL_PARTS) {
          rack.setReverbSend(part, sendsRef.current[part])
        }
      })

      const failedSamples = new Set<string>()
      for (const instrument of loaded.values()) {
        instrument.bank.getFailures().forEach((failure) => failedSamples.add(failure))
      }
      rockSolidGuitar?.bank
        .getFailures()
        .forEach((failure) => failedSamples.add(failure))
      if (failedSamples.size > 0) {
        setInstrumentWarning(
          `${failedSamples.size} instrument sample${failedSamples.size === 1 ? "" : "s"} could not be loaded. Some articulations may be silent.`,
        )
      }

      setProgress(null)
      readyRef.current = true
      instrumentsStaleRef.current = false
      loadedStyleRef.current = requestedStyleId
      return player
    } catch (err) {
      discardCandidate()
      console.error(err)
      setInstrumentError(
        "The instrument samples could not be loaded. Check the connection and try again.",
      )
      setStatus("idle")
      setProgress(null)
      return null
    }
  }, [arrangement, styleId, style, midiLive, midi.midiOut, soloed])

  const ensurePlayer = useCallback((): Promise<BandPlayer | null> => {
    const pending = playerLoadRef.current
    if (pending) return pending
    const request = loadPlayer()
    playerLoadRef.current = request
    void request.then(
      () => {
        if (playerLoadRef.current === request) playerLoadRef.current = null
      },
      () => {
        if (playerLoadRef.current === request) playerLoadRef.current = null
      },
    )
    return request
  }, [loadPlayer])

  /** Commit one complete playback pass to browser audio and Web MIDI. */
  const installPlaybackPass = useCallback((
    playable: Arrangement,
    options: { startBar?: number; resume: boolean; range: LoopRange | null },
  ) => {
    controllerRef.current?.installPlaybackPass(playable, {
      ...options,
      tempo: tempoRef.current,
      countIn: countInRef.current,
      metronome: metronomeRef.current,
    })
  }, [])

  // Song/key/reharmonization/Arranger/variation changes all arrive here and
  // nowhere else. Restart at the beginning of the active section, matching
  // the desktop Jam Player instead of preserving a random beat in its middle.
  useEffect(() => {
    const player = controllerRef.current?.getPlayer()
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
    let lastAudioTime: number | null = null
    let wasCountingIn = false
    let lastUiUpdate = 0
    let lastBar: number | null = null
    const tick = (now: number) => {
      const controller = controllerRef.current
      if (controller?.getStatus() === "playing") {
        const audioTime = controller.getContext()?.currentTime ?? null
        const countingIn = controller.isCountingIn()
        if (audioTime !== null) {
          spanBeatsRef.current += elapsedBeatsForAudioTime(
            lastAudioTime,
            audioTime,
            controller.getTempo(),
            countingIn || wasCountingIn,
          )
          lastAudioTime = audioTime
        }
        wasCountingIn = countingIn

        if (rampOn && targetTempo) {
          const next = rampTempo(spanStartTempoRef.current, spanBeatsRef.current, {
            ...DEFAULT_RAMP,
            targetTempo,
          })
          if (next !== controller.getTempo()) {
            const applied = controller.setTempo(next)
            tempoRef.current = applied
            setTempo(applied)
          }
        }

        // UI updates are intentionally capped at 20 Hz. Audio and MIDI keep
        // their own look-ahead clocks and are never driven by React rendering.
        if (now - lastUiUpdate >= 50) {
          const beat = controller.getCurrentBeat()
          const bar = controller.getCurrentBar()
          if (bar !== lastBar) {
            lastBar = bar
            setCurrentBar(bar)
          }
          setBarPhase((beat % 4) / 4)
          lastUiUpdate = now
        }
      } else {
        lastAudioTime = null
        wasCountingIn = false
        lastBar = null
        setBarPhase((current) => (current === 0 ? current : 0))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [rampOn, targetTempo])

  useEffect(
    () => () => {
      instrumentLoadRevisionRef.current += 1
      playerLoadRef.current = null
      controllerRef.current?.dispose()
      instrumentRepositoryRef.current?.clear()
      instrumentRepositoryRef.current = null
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
      controllerRef.current?.pause()
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
    const player = controllerRef.current?.getPlayer()
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
    playerLoadRef.current = null
    const prev = loadedStyleRef.current
    if (!styleId || !prev || prev === styleId) return
    instrumentsStaleRef.current = true
    const player = controllerRef.current?.getPlayer()
    if (player?.getStatus() === "playing") commitSpan()
    controllerRef.current?.disposeAudio(false)
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
    controllerRef.current?.setMix(next)
  }

  /** Solo mutes everything else without destroying the user's own mute state. */
  const applySolo = (part: BandPart | null) => {
    setSoloed(part)
    controllerRef.current?.setSoloed(part)
  }

  const pickUserPart = (part: BandPart | null) => {
    setUserPart(part)
    const next = { ...mixRef.current }
    for (const p of ALL_PARTS) {
      next[p] = { ...next[p], muted: p === part ? true : p === "solo" ? next[p].muted : false }
    }
    if (part) next[part] = { ...next[part], muted: true }
    applyMix(next)
  }

  const dataError = loadError || styleLoadError || progressionLoadError
  const visibleError = dataError || arrangementError || instrumentError
  if (visibleError) {
    return (
      <div className="pt-32 pb-16">
        <div className="content-wrap">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            <p>{visibleError}</p>
            {dataError ? (
              <button
                type="button"
                onClick={() => {
                  clearJamPlayerCatalogCaches()
                  setLoadError("")
                  setStyleLoadError("")
                  setProgressionLoadError("")
                  setCatalog(null)
                  setClips(null)
                  setLoadedProgression(null)
                  setDataReloadRevision((revision) => revision + 1)
                }}
                className="mt-3 rounded-lg border border-rose-200/25 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-100/10"
              >
                Retry Jam Player data
              </button>
            ) : null}
            {instrumentError ? (
              <button
                type="button"
                onClick={() => {
                  instrumentsStaleRef.current = true
                  setInstrumentError("")
                  void ensurePlayer()
                }}
                className="mt-3 rounded-lg border border-rose-200/25 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-100/10"
              >
                Retry instrument loading
              </button>
            ) : null}
          </div>
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
      controllerRef.current?.stop()
      commitSpan()
      setCurrentBar(null)
    },
    onTempo: (bpm: number) => {
      const applied = controllerRef.current?.setTempo(bpm) ?? bpm
      tempoRef.current = applied
      setTempo(applied)
      spanStartTempoRef.current = bpm
      spanBeatsRef.current = 0
    },
    onTranspose: (semis: number) =>
      setKeyPc((k) => (((k + semis) % 12) + 12) % 12),
    onToggleCountIn: () => setCountIn((v) => !v),
    onToggleMetronome: () => {
      setMetronome((v) => {
        controllerRef.current?.setMetronome(!v)
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
    controllerRef.current?.getEffects()?.setReverbSend(part, value)
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
      controllerRef.current?.getEffects()?.setPartUserEq(part, next[part])
      markMixDirty()
    },
    sends,
    onSend: changeSend,
    pan: channelPan,
    onPan: (part: BandPart, value: number) => {
      const next = { ...panRef.current, [part]: value }
      panRef.current = next
      setChannelPan(next)
      controllerRef.current?.getEffects()?.setPartPan(part, value)
      markMixDirty()
    },
    room: reverbWet,
    onRoom: (value: number) => {
      roomRef.current = value
      setReverbWet(value)
      controllerRef.current?.getEffects()?.setReverbWet(value)
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
      const next = loadStyleMixer(
        styleId,
        variation,
        defaultStyleMixer(styleId),
      )
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
        controllerRef.current?.getEffects()?.setPartUserEq(part, next.eq[part])
        controllerRef.current?.getEffects()?.setPartPan(part, next.pan[part])
        controllerRef.current?.getEffects()?.setReverbSend(part, next.sends[part])
      }
      controllerRef.current?.getEffects()?.setReverbWet(next.room)
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
                className="mb-4 flex items-center gap-2 py-2 text-xs text-white/35 transition hover:text-white/70"
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
                preset={controllerRef.current?.getEffects()?.getPreset() ?? presetForStyle(styleId)}
                bypassed={fxBypassed}
                onBypass={(bypassed) => {
                  setFxBypassed(bypassed)
                  controllerRef.current?.getEffects()?.setBypass(bypassed)
                }}
                reverbWet={reverbWet}
                onReverbWet={(value) => {
                  roomRef.current = value
                  setReverbWet(value)
                  controllerRef.current?.getEffects()?.setReverbWet(value)
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
            {progress !== null ? (
              <div
                className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:w-36"
                role="progressbar"
                aria-label="Loading instruments"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div
                  className="h-full rounded-full bg-orange-400 transition-[width] duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}
            {instrumentWarning ? (
              <p className="hidden max-w-sm text-[10px] leading-relaxed text-amber-200/70 md:block" role="status">
                {instrumentWarning}
              </p>
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
              <div className="mx-auto grid max-w-6xl grid-cols-[minmax(240px,0.85fr)_minmax(0,1.4fr)] gap-3">
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
        <PlayerPanelDialog
          title={
            mobilePanel === "setup"
              ? "Player setup"
              : mobilePanel === "arrange"
                ? "Full arranger"
                : "Full mixer"
          }
          onClose={() => setMobilePanel(null)}
        >
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
                preset={controllerRef.current?.getEffects()?.getPreset() ?? presetForStyle(styleId)}
                bypassed={fxBypassed}
                onBypass={(bypassed) => {
                  setFxBypassed(bypassed)
                  controllerRef.current?.getEffects()?.setBypass(bypassed)
                }}
                reverbWet={reverbWet}
                onReverbWet={(value) => {
                  roomRef.current = value
                  setReverbWet(value)
                  controllerRef.current?.getEffects()?.setReverbWet(value)
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
        </PlayerPanelDialog>
      ) : null}
    </div>
  )
}
