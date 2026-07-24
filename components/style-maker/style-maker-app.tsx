"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  Hammer,
  LoaderCircle,
  Music2,
  Package,
  SlidersHorizontal,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import {
  AppTabNav,
  CollapsibleCard,
  EmptyState,
  SectionLabel,
  StatusChip,
} from "@/components/ux"
import {
  extractMidiNotes,
  extractStyleSections,
  parseYamahaStyle,
  type MidiNote,
  type ParsedYamahaStyle,
  type StyleSectionRange,
} from "@/lib/demo/style-midi"
import { StylePreviewPlayer } from "@/lib/demo/style-preview"
import type { TransferProgress, YamahaModelId } from "@/lib/demo/types"
import { MusicsoftTransfer } from "@/lib/demo/yamaha/musicsoft-transfer"
import {
  ALL_YAMAHA_MODEL_IDS,
  KEYBOARD_PROFILES,
} from "@/lib/demo/yamaha/profiles"
import { useMidiSession } from "@/lib/demo/yamaha/use-midi-session"
import {
  applyBassAuditionEventTransforms,
  applyDrumMappingToEvents,
  auditionChordForPreview,
  clampMidiChannel,
  DEFAULT_AUDITION_CHANNELS,
  defaultAuditionChannels,
  extractClipAuditionEvents,
  extractLaneAuditionEvents,
  extractLaneTemplateNotes,
  extractSectionAuditionEventsWithTakes,
  laneHasTemplateMinorSource,
  laneSupportsMinorTake,
  notesToAuditionEvents,
  sectionSupportsMinorPreview,
  type AuditionChannelMap,
  type AuditionInstrument,
} from "@/lib/style-maker/audition"
import { yamahaTemplateSectionName } from "@/lib/style-maker/section-names"
import {
  acceptedHint,
  ALL_STYLE_MAKER_LANES,
  applyPartTypeChoice,
  defaultPartTypeIndex,
  displayName,
  guitarCasmModeName,
  isYamahaGuitarSourceMode,
  laneAccepts,
  laneCanUseGuitar,
  laneNeedsPartTypePrompt,
  partTypeChoicesForLane,
  sectionIsIntroOrEnding,
  sourceKindForLane,
  StyleMakerGuitarCasmMode,
  StyleMakerLane,
  styleChannel,
} from "@/lib/style-maker/lanes"
import {
  defaultVoiceSelection,
  sendXgPartVoice,
  voiceChoicesForInstrument,
  xgVoiceSetupMessages,
  type VoiceSelectionMap,
} from "@/lib/style-maker/audition-voice"
import {
  DEFAULT_BASS_VOICE_ID,
  DEFAULT_DRUM_KIT_ID,
  DEFAULT_GUITAR_VOICE_ID,
  findVoiceChoice,
  type VoiceChoice,
} from "@/lib/style-maker/megavoice-catalog"
import {
  findVoiceChoiceByBank,
  libraryDefaultsFromStyle,
} from "@/lib/style-maker/library-style-defaults"
import {
  BASS_SECTION_OPTIONS,
  bassBpmMatchesTempoBand,
  DRUM_AUTO_CHANNEL,
  DRUM_SECTION_OPTIONS,
  FEEL_MODE_OPTIONS,
  findBassProfileIndexByBank,
  findBassProfileIndexByName,
  applyBassAuditionTransforms,
  applyDrumMappingToNotes,
  isGenosFamilyProfileId,
  resolveDrumAuditionChannel,
  resolveDrumMappingMode,
  sectionLooksLikeFill,
  TEMPO_BAND_OPTIONS,
  TIME_FEEL_OPTIONS,
  timeFeelFactor,
  VELOCITY_DELTA_OPTIONS,
  type DrumMappingMode,
  type FeelModeFilter,
  type TempoBandId,
  type TimeFeelId,
} from "@/lib/style-maker/library-panel"
import { isExcludedDrumLibraryCategory } from "@/lib/style-maker/drum-library-categories"
import { tempoCommand } from "@/lib/demo/yamaha/commands"
import { sendPresetStyleSelect } from "@/lib/demo/yamaha/style-select"
import { StyleCatalogControls } from "@/components/demo/style-catalog-controls"
import {
  replaceStyleProjectProduct,
  type LaneReplacement,
  type StyleSectionLaneReplacements,
} from "@/lib/style-maker/replace-lanes"
import {
  applyPartMixerToHardware,
  clonePartMixerMap,
  copyCurrentSectionVoicesToAllSections,
  ensureWorkingMixer,
  extractSectionPartSnapshots,
  laneRowTitle,
  partMixerHasAny,
  saveCurrentSectionMix as commitSectionPartMixer,
  selectSectionMixer,
  upsertWorkingLane,
  type PartMixerMap,
  type TemplatePartSnapshot,
} from "@/lib/style-maker/part-mixer"
import { StylePartMixerPanel } from "@/components/style-maker/style-part-mixer"
import {
  PianoRollModal,
  type PianoRollOpenTarget,
} from "@/components/style-maker/piano-roll-modal"
import {
  writeBodyFromSnapshot,
  snapshotFromProjectWire,
  sanitizeProjectName,
} from "@/lib/style-maker/project-store"
import {
  createStyleMakerProject,
  deleteStyleMakerProject,
  getStyleMakerProject,
  listStyleMakerProjects,
  updateStyleMakerProject,
} from "@/lib/style-maker/projects-api"
import type { StyleMakerProjectListItem } from "@/lib/style-maker/project-store"
import {
  clearLegacyStyleMakerWorkspace,
  clearStyleMakerDraft,
  loadLegacyStyleMakerWorkspace,
  loadStyleMakerDraft,
  saveStyleMakerDraft,
  type SectionAssignmentMap,
  type StyleMakerWorkspaceSnapshot,
} from "@/lib/style-maker/workspace-cache"

type LibraryTab = "bass" | "drums" | "guitar" | "brass"

type LibraryClipMeta = {
  id: number
  sourceKind: string
  categoryName: string | null
  subcategoryName: string | null
  clipName: string | null
  feelName: string | null
  feelMode: string | null
  bpm: number | null
  sectionType: string | null
  noteCount: number
  bars?: number | null
}

type LaneAssignment = {
  title: string
  subtitle: string
  notes: MidiNote[]
  cycleTicks: number
  origin: "library" | "upload" | "template"
  clipId?: number
  sourceKind: string
  /** Frozen / imported take — required for Yamaha Guitar-source CASM modes. */
  frozen: boolean
}

type PartTypePrompt = {
  lane: StyleMakerLane
  clipName: string
  sourceKind: string
  selectedIndex: number
  resolve: (
    choice: {
      sourceKind: string
      guitarMode: StyleMakerGuitarCasmMode
    } | null,
  ) => void
}

const SECTIONS = [
  "Intro 1",
  "Intro 2",
  "Intro 3",
  "Main A",
  "Main B",
  "Main C",
  "Main D",
  "Fill A",
  "Fill B",
  "Fill C",
  "Fill D",
  "Ending 1",
  "Ending 2",
  "Ending 3",
]

const ALL_LANES = ALL_STYLE_MAKER_LANES

/** Temporarily hide Rhythm Guitar / Brass Performance browse tabs. */
const LIB_TABS_HIDDEN = new Set<LibraryTab>(["guitar", "brass"])

const ALL_LIB_TABS: { id: LibraryTab; label: string }[] = [
  { id: "bass", label: "Bass Performance" },
  { id: "drums", label: "Drum Performance" },
  { id: "guitar", label: "Rhythm Guitar" },
  { id: "brass", label: "Brass Performance" },
]

const LIB_TABS = ALL_LIB_TABS.filter((tab) => !LIB_TABS_HIDDEN.has(tab.id))

const GUITAR_CASM_MODE_OPTIONS: StyleMakerGuitarCasmMode[] = [
  StyleMakerGuitarCasmMode.RenderedMegaVoice,
  StyleMakerGuitarCasmMode.PreserveDonor,
  StyleMakerGuitarCasmMode.YamahaSourceStrum,
  StyleMakerGuitarCasmMode.YamahaSourceArpeggio,
  StyleMakerGuitarCasmMode.YamahaSourceMixed,
]

function sourceKindForLibraryTab(tab: LibraryTab): string {
  return tab
}

function isMidiFileName(name: string): boolean {
  const lower = name.trim().toLowerCase()
  return lower.endsWith(".mid") || lower.endsWith(".midi")
}

/** Desktop LaneSlot::isInterestedInFileDrag — .mid / .midi only. */
function midiFileFromDataTransfer(dataTransfer: DataTransfer): File | null {
  const files = Array.from(dataTransfer.files || [])
  return files.find((file) => isMidiFileName(file.name)) || null
}

function dragHasExternalFiles(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types || []).includes("Files")
}

function dragHasLibraryClip(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types || []).includes(CLIP_DND_TYPE)
}

function styleStemFromFileName(name: string | null | undefined): string {
  const raw = (name || "SmartBridgeStyle").trim()
  return raw.replace(/\.(sty|prs|sst|fps)$/i, "") || "SmartBridgeStyle"
}

function styleExtensionFromFileName(name: string | null | undefined): string {
  const match = (name || "").match(/\.(sty|prs|sst|fps)$/i)
  return match ? match[0].toLowerCase() : ".prs"
}

function sanitizeStyleFileName(stem: string, extension: string): string {
  const cleanStem =
    stem.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") ||
    "SmartBridgeStyle"
  const ext = extension.startsWith(".") ? extension : `.${extension}`
  return `${cleanStem}${ext}`
}

/** HTML5 DnD payload for library → lane assignment */
const CLIP_DND_TYPE = "application/x-smartbridge-library-clip"

const isMainSection = (section: StyleSectionRange) =>
  /^Main\s+[A-D]$/i.test(section.label.trim())

const isAssignableSection = (section: StyleSectionRange) =>
  /^(Main|Fill)\s+[A-D]$/i.test(section.label.trim()) ||
  sectionIsIntroOrEnding(section.label)

type ChordVariant = "major" | "minor"

function instrumentForLibTab(tab: LibraryTab): AuditionInstrument {
  if (tab === "drums") return "drums"
  if (tab === "bass") return "bass"
  if (tab === "guitar") return "guitar"
  return "brass"
}

function formatClipTitle(name: string | null | undefined, id: number): string {
  const raw = (name || `Clip ${id}`).trim()
  return raw
    .replace(/\s+[a-f0-9]{8,}$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
}

function meterLevel(noteCount: number): number {
  if (noteCount <= 0) return 1
  if (noteCount < 12) return 2
  if (noteCount < 28) return 3
  if (noteCount < 60) return 4
  return 5
}

type SectionLaneMap = Record<StyleMakerLane, LaneAssignment | null>

function emptyAssignments(): SectionLaneMap {
  return {
    [StyleMakerLane.Rhythm1]: null,
    [StyleMakerLane.Rhythm2]: null,
    [StyleMakerLane.Bass]: null,
    [StyleMakerLane.Chord1]: null,
    [StyleMakerLane.Chord2]: null,
    [StyleMakerLane.Pad]: null,
    [StyleMakerLane.Phrase1]: null,
    [StyleMakerLane.Phrase2]: null,
  }
}

function laneMapFromCached(cached?: SectionAssignmentMap): SectionLaneMap {
  const next = emptyAssignments()
  if (!cached) return next
  for (const lane of ALL_LANES) {
    const row = cached[lane]
    if (row) next[lane] = { ...row }
  }
  return next
}

function cachedFromLaneMap(map: SectionLaneMap): SectionAssignmentMap {
  const out: SectionAssignmentMap = {}
  for (const lane of ALL_LANES) {
    const row = map[lane]
    if (row) out[lane] = { ...row }
  }
  return out
}

function countAssignedInMap(map: SectionLaneMap | undefined): number {
  if (!map) return 0
  return Object.values(map).filter(Boolean).length
}

function countAllSectionTakes(
  major: Record<string, SectionLaneMap>,
  minor: Record<string, SectionLaneMap>,
): number {
  let total = 0
  for (const map of Object.values(major)) total += countAssignedInMap(map)
  for (const map of Object.values(minor)) total += countAssignedInMap(map)
  return total
}

function laneReplacementFromAssignment(
  assignment: LaneAssignment,
  guitarCasmMode: StyleMakerGuitarCasmMode,
): LaneReplacement {
  return {
    notes: assignment.notes,
    cycleTicks: assignment.cycleTicks,
    sourceKind: assignment.sourceKind,
    guitarCasmMode,
    frozen: assignment.frozen,
  }
}

async function fetchLibraryClips(
  sourceKind: LibraryTab,
  filters: {
    category?: string
    feelMode?: string
    sectionType?: string
    q?: string
    excludeFillSections?: boolean
  },
): Promise<{ clips: LibraryClipMeta[]; total: number }> {
  const params = new URLSearchParams({
    sourceKind,
    limit: "500",
  })
  if (filters.category) params.set("category", filters.category)
  if (filters.feelMode) params.set("feelMode", filters.feelMode)
  if (filters.sectionType) params.set("sectionType", filters.sectionType)
  if (filters.q) params.set("q", filters.q)
  if (filters.excludeFillSections) params.set("excludeFillSections", "1")
  const response = await fetch(`/api/style-maker/library?${params}`)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "Library browse failed")
  return data
}

async function fetchClipMidi(id: number): Promise<Uint8Array> {
  const response = await fetch(`/api/style-maker/library/${id}`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || "Could not load clip MIDI")
  }
  return new Uint8Array(await response.arrayBuffer())
}

export function StyleMakerApp() {
  /**
   * Account id for draft keys — from /api/style-maker/entitlement so we never
   * require <ClerkProvider> (layout omits it when Clerk keys are unset).
   */
  const [accountUserId, setAccountUserId] = useState("local-dev-user")
  const [authLoaded, setAuthLoaded] = useState(false)
  const [session, midi] = useMidiSession()
  const [modeTab, setModeTab] = useState<"build" | "mixer" | "export">("build")
  const [setupOpen, setSetupOpen] = useState(false)
  const [libFiltersOpen, setLibFiltersOpen] = useState(false)
  const [sectionName, setSectionName] = useState("Main A")
  const [bars, setBars] = useState(2)
  const [includeCC, setIncludeCC] = useState(true)
  const [selectedLane, setSelectedLane] = useState<StyleMakerLane>(StyleMakerLane.Rhythm1)
  /** StyleSectionRecipe::lanes / minorLanes keyed by section display label. */
  const [sectionAssignments, setSectionAssignments] = useState<
    Record<string, SectionLaneMap>
  >({})
  const [sectionMinorAssignments, setSectionMinorAssignments] = useState<
    Record<string, SectionLaneMap>
  >({})
  const [selectedVariant, setSelectedVariant] = useState<ChordVariant>("major")
  const [dropVariant, setDropVariant] = useState<ChordVariant | null>(null)
  const [donorFile, setDonorFile] = useState<File | null>(null)
  const [donor, setDonor] = useState<ParsedYamahaStyle | null>(null)
  const [modified, setModified] = useState<Uint8Array | null>(null)
  const [status, setStatus] = useState("Import a style template to begin.")
  const [libTab, setLibTab] = useState<LibraryTab>("bass")
  const [clips, setClips] = useState<LibraryClipMeta[]>([])
  const [totalClips, setTotalClips] = useState(0)
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [facetSections, setFacetSections] = useState<string[]>([])
  const [genre, setGenre] = useState("all")
  const [sectionFilter, setSectionFilter] = useState("")
  const [feelMode, setFeelMode] = useState<FeelModeFilter>("")
  const [tempoBand, setTempoBand] = useState<TempoBandId>(1)
  const [bassTimeFeel, setBassTimeFeel] = useState<TimeFeelId>(2)
  const [bassVel, setBassVel] = useState(0)
  const [bassDead, setBassDead] = useState(0)
  const [drumChannelSelection, setDrumChannelSelection] = useState(DRUM_AUTO_CHANNEL)
  const [drumMapping, setDrumMapping] = useState<DrumMappingMode>("ambient")
  const [voiceSearch, setVoiceSearch] = useState("")
  const [search, setSearch] = useState("")
  const [loadingClips, setLoadingClips] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [auditionChannels, setAuditionChannels] = useState<AuditionChannelMap>(
    defaultAuditionChannels,
  )
  const [voiceSelection, setVoiceSelection] = useState<VoiceSelectionMap>(
    defaultVoiceSelection,
  )
  /** Style-sourced bass/drum voices not present in the static MegaVoice lists. */
  const [styleLibraryVoices, setStyleLibraryVoices] = useState<
    Partial<Record<AuditionInstrument, VoiceChoice>>
  >({})
  /** Model-scoped audition lists from keyboard_voices; null = use static MegaVoice maps. */
  const [modelAuditionChoices, setModelAuditionChoices] = useState<Partial<
    Record<AuditionInstrument, VoiceChoice[]>
  > | null>(null)
  const [dropLane, setDropLane] = useState<StyleMakerLane | null>(null)
  const [dropKind, setDropKind] = useState<"clip" | "midi" | null>(null)
  const [transfer, setTransfer] = useState<TransferProgress | null>(null)
  const [transferComplete, setTransferComplete] = useState("")
  const [transferNamePrompt, setTransferNamePrompt] = useState<{
    name: string
  } | null>(null)
  const [guitarCasmModes, setGuitarCasmModes] = useState<
    Partial<Record<StyleMakerLane, StyleMakerGuitarCasmMode>>
  >({})
  /** Saved StyleSectionRecipe::partMixer per section display label. */
  const [savedPartMixers, setSavedPartMixers] = useState<
    Record<string, PartMixerMap>
  >({})
  /** Mixer tab working copy (desktop AuditionTab m_workingMixers). */
  const [workingPartMixers, setWorkingPartMixers] = useState<
    Record<string, PartMixerMap>
  >({})
  const [dirtyMixerSections, setDirtyMixerSections] = useState<Set<string>>(
    () => new Set(),
  )
  const [partTypePrompt, setPartTypePrompt] = useState<PartTypePrompt | null>(
    null,
  )
  /** Pending filesystem style import waiting for clear-everything confirmation. */
  const [pendingTemplateImport, setPendingTemplateImport] = useState<{
    file: File
  } | null>(null)
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null)
  const [cloudProjectName, setCloudProjectName] = useState<string | null>(null)
  const [projectDirty, setProjectDirty] = useState(false)
  const [projectList, setProjectList] = useState<StyleMakerProjectListItem[]>(
    [],
  )
  const [projectBusy, setProjectBusy] = useState(false)
  const [openProjectModal, setOpenProjectModal] = useState(false)
  const [saveAsPrompt, setSaveAsPrompt] = useState<{
    name: string
    mode: "save-as" | "migrate"
  } | null>(null)
  const [deleteProjectPrompt, setDeleteProjectPrompt] = useState(false)
  const [pendingOpenProjectId, setPendingOpenProjectId] = useState<
    string | null
  >(null)
  const [pianoRollTarget, setPianoRollTarget] =
    useState<PianoRollOpenTarget | null>(null)
  const preview = useRef<StylePreviewPlayer | null>(null)
  const templateInput = useRef<HTMLInputElement>(null)
  const workspaceReady = useRef(false)
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false)
  const cloudProjectIdRef = useRef<string | null>(null)
  cloudProjectIdRef.current = cloudProjectId
  const accountUserIdRef = useRef(accountUserId)
  accountUserIdRef.current = accountUserId
  /** Suppress dirty flag while hydrating / opening a cloud project. */
  const suppressDirtyRef = useRef(false)

  useEffect(() => {
    preview.current = new StylePreviewPlayer(session, () => setPreviewing(false))
    return () => preview.current?.stop()
  }, [session])

  // Resolve Clerk / local-dev user id without useAuth (ClerkProvider is optional).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch("/api/style-maker/entitlement")
        const data = (await response.json().catch(() => ({}))) as {
          userId?: string | null
        }
        if (!cancelled) {
          setAccountUserId(data.userId || "local-dev-user")
        }
      } catch {
        if (!cancelled) setAccountUserId("local-dev-user")
      } finally {
        if (!cancelled) setAuthLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Reconnect the last keyboard pair (cached port ids / names).
  useEffect(() => {
    if (midi.connected || midi.connecting) return
    void session.requestAccess()
    // Only on mount — avoid reconnect loops when snapshot updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // Load MegaVoice / DrumKit audition lists for the selected keyboard model.
  useEffect(() => {
    const modelKey = midi.profile?.id
    if (!modelKey) {
      setModelAuditionChoices(null)
      return
    }
    let cancelled = false
    const families: AuditionInstrument[] = ["bass", "guitar", "drums", "brass"]
    ;(async () => {
      const next: Partial<Record<AuditionInstrument, VoiceChoice[]>> = {}
      await Promise.all(
        families.map(async (family) => {
          try {
            const params = new URLSearchParams({
              auditionFamily: family,
              modelKey,
              limit: "300",
            })
            const response = await fetch(`/api/style-maker/voices?${params}`)
            if (!response.ok) return
            const data = await response.json()
            const voices = (data.voices || []) as VoiceChoice[]
            if (voices.length) next[family] = voices
          } catch {
            /* keep static fallback for this family */
          }
        }),
      )
      if (cancelled) return
      setModelAuditionChoices(Object.keys(next).length ? next : null)
      setVoiceSelection((prev) => {
        const updated = { ...prev }
        for (const family of families) {
          const list = next[family]
          if (!list?.length) continue
          if (list.some((voice) => voice.id === updated[family])) continue
          // Keep the same bank/program when model ids differ from static catalogs.
          const staticHit = voiceChoicesForInstrument(family).find(
            (voice) => voice.id === updated[family],
          )
          const styleHit = styleLibraryVoices[family]
          const bankSrc = staticHit || styleHit
          if (bankSrc) {
            const byBank = findVoiceChoiceByBank(
              list,
              bankSrc.msb,
              bankSrc.lsb,
              bankSrc.programYamaha,
            )
            if (byBank) {
              updated[family] = byBank.id
              continue
            }
          }
          const preferred =
            family === "bass"
              ? DEFAULT_BASS_VOICE_ID
              : family === "guitar"
                ? DEFAULT_GUITAR_VOICE_ID
                : family === "drums"
                  ? DEFAULT_DRUM_KIT_ID
                  : "BrassSection"
          updated[family] =
            list.find((voice) => voice.id === preferred)?.id || list[0].id
        }
        return updated
      })
    })()
    return () => {
      cancelled = true
    }
    // styleLibraryVoices intentionally omitted — only re-fetch on model change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midi.profile?.id])

  const applyWorkspaceSnapshot = useCallback(
    (
      cached: StyleMakerWorkspaceSnapshot,
      options?: { cloudId?: string | null; cloudName?: string | null },
    ) => {
      suppressDirtyRef.current = true
      const donorBytes = Uint8Array.from(cached.donorBytes)
      const parsed = parseYamahaStyle(donorBytes)
      if (!parsed.yamahaTail.length) {
        suppressDirtyRef.current = false
        throw new Error("Cached style has no CASM tail.")
      }
      const file = new File([donorBytes], cached.donorFileName, {
        type: "application/octet-stream",
      })
      const nextSectionAssignments: Record<string, SectionLaneMap> = {}
      for (const [key, map] of Object.entries(
        cached.sectionAssignments || {},
      )) {
        nextSectionAssignments[key] = laneMapFromCached(map)
      }
      const nextSectionMinors: Record<string, SectionLaneMap> = {}
      for (const [key, map] of Object.entries(
        cached.sectionMinorAssignments || {},
      )) {
        nextSectionMinors[key] = laneMapFromCached(map)
      }
      setDonorFile(file)
      setDonor(parsed)
      setSectionName(cached.sectionName)
      setBars(cached.bars)
      setIncludeCC(cached.includeCC)
      setSelectedLane(cached.selectedLane)
      setLibTab(
        cached.libTab === "guitar" || cached.libTab === "brass"
          ? "bass"
          : cached.libTab,
      )
      setSectionAssignments(nextSectionAssignments)
      setSectionMinorAssignments(nextSectionMinors)
      setGuitarCasmModes(cached.guitarCasmModes || {})
      setAuditionChannels(cached.auditionChannels || defaultAuditionChannels())
      setVoiceSelection(cached.voiceSelection || defaultVoiceSelection())
      setSavedPartMixers(cached.partMixers || {})
      setWorkingPartMixers({})
      setDirtyMixerSections(new Set())
      setModified(
        cached.lastBuiltBytes?.length
          ? Uint8Array.from(cached.lastBuiltBytes)
          : null,
      )
      const cloudId =
        options?.cloudId !== undefined
          ? options.cloudId
          : cached.cloudProjectId || null
      const cloudName =
        options?.cloudName !== undefined
          ? options.cloudName
          : cached.cloudProjectName || null
      setCloudProjectId(cloudId)
      setCloudProjectName(cloudName)
      window.setTimeout(() => {
        suppressDirtyRef.current = false
      }, 0)
      return {
        takeCount: countAllSectionTakes(
          nextSectionAssignments,
          nextSectionMinors,
        ),
        sectionCount: Object.keys(nextSectionAssignments).length,
      }
    },
    [],
  )

  // Restore local draft (and optionally prompt to migrate legacy browser cache).
  useEffect(() => {
    if (!authLoaded) return
    let cancelled = false
    ;(async () => {
      try {
        let projects: StyleMakerProjectListItem[] = []
        try {
          projects = await listStyleMakerProjects()
        } catch {
          projects = []
        }
        if (cancelled) return
        setProjectList(projects)

        // Prefer unsaved draft, then any draft tied to a known cloud project.
        let cached = await loadStyleMakerDraft({
          userId: accountUserId,
          projectId: null,
        })
        if (!cached) {
          for (const item of projects) {
            cached = await loadStyleMakerDraft({
              userId: accountUserId,
              projectId: item.id,
            })
            if (cached) break
          }
        }

        const legacy = cached ? null : await loadLegacyStyleMakerWorkspace()
        if (cancelled) return

        if (cached) {
          const stats = applyWorkspaceSnapshot(cached)
          setProjectDirty(true)
          setStatus(
            `Restored draft “${cached.donorFileName}”${
              cached.cloudProjectName ? ` · ${cached.cloudProjectName}` : ""
            } · ${stats.takeCount} take(s)`,
          )
        } else if (legacy) {
          const stats = applyWorkspaceSnapshot(legacy, {
            cloudId: null,
            cloudName: null,
          })
          setProjectDirty(true)
          setStatus(
            `Restored browser cache “${legacy.donorFileName}” · ${stats.takeCount} take(s)`,
          )
          if (!projects.length) {
            setSaveAsPrompt({
              name: sanitizeProjectName(
                legacy.donorFileName.replace(/\.(sty|prs|sst|fps)$/i, "") ||
                  "My Style Project",
              ),
              mode: "migrate",
            })
          }
        }
      } catch {
        /* corrupt cache — start empty */
      } finally {
        if (!cancelled) {
          workspaceReady.current = true
          setWorkspaceHydrated(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accountUserId, applyWorkspaceSnapshot, authLoaded])

  const styleSections = useMemo(
    () => (donor ? extractStyleSections(donor) : []),
    [donor],
  )

  const selectedSection = useMemo(() => {
    if (!styleSections.length) return null
    return (
      styleSections.find(
        (section) => section.label.trim().toLowerCase() === sectionName.toLowerCase(),
      ) || styleSections[0]
    )
  }, [sectionName, styleSections])

  const templatePartSnapshots = useMemo((): Partial<
    Record<StyleMakerLane, TemplatePartSnapshot>
  > => {
    if (!donor || !selectedSection) return {}
    return extractSectionPartSnapshots(donor, selectedSection)
  }, [donor, selectedSection])

  const sectionMixerKey = selectedSection?.label.trim() || sectionName.trim()
  const activeSectionKey = sectionMixerKey
  const activeSectionKeyRef = useRef(activeSectionKey)
  activeSectionKeyRef.current = activeSectionKey

  /** Active section's major takes (desktop StyleSectionRecipe::lanes). */
  const assignments = useMemo(
    () => sectionAssignments[activeSectionKey] ?? emptyAssignments(),
    [activeSectionKey, sectionAssignments],
  )
  /** Active section's minor takes (Intro/Ending). */
  const minorAssignments = useMemo(
    () => sectionMinorAssignments[activeSectionKey] ?? emptyAssignments(),
    [activeSectionKey, sectionMinorAssignments],
  )

  const setAssignments = useCallback(
    (update: SectionLaneMap | ((prev: SectionLaneMap) => SectionLaneMap)) => {
      const key = activeSectionKeyRef.current
      if (!key) return
      setSectionAssignments((prev) => {
        const current = prev[key] ?? emptyAssignments()
        const next = typeof update === "function" ? update(current) : update
        return { ...prev, [key]: next }
      })
    },
    [],
  )

  const setMinorAssignments = useCallback(
    (update: SectionLaneMap | ((prev: SectionLaneMap) => SectionLaneMap)) => {
      const key = activeSectionKeyRef.current
      if (!key) return
      setSectionMinorAssignments((prev) => {
        const current = prev[key] ?? emptyAssignments()
        const next = typeof update === "function" ? update(current) : update
        return { ...prev, [key]: next }
      })
    },
    [],
  )

  const workingMixerForSection = useMemo((): PartMixerMap => {
    if (!sectionMixerKey) return {}
    if (workingPartMixers[sectionMixerKey]) {
      return workingPartMixers[sectionMixerKey]
    }
    return savedPartMixers[sectionMixerKey] || {}
  }, [savedPartMixers, sectionMixerKey, workingPartMixers])

  // Library Voice/Channel defaults follow the active section's style bass & drums.
  useEffect(() => {
    if (!donor || !selectedSection) return
    const bassChoices =
      modelAuditionChoices?.bass?.length
        ? modelAuditionChoices.bass
        : voiceChoicesForInstrument("bass")
    const drumChoices =
      modelAuditionChoices?.drums?.length
        ? modelAuditionChoices.drums
        : voiceChoicesForInstrument("drums")
    const defaults = libraryDefaultsFromStyle({
      snapshots: templatePartSnapshots,
      sectionMixer: workingMixerForSection,
      bassChoices,
      drumChoices,
    })
    if (!defaults.bassVoice && !defaults.drumVoice) return

    setStyleLibraryVoices((prev) => ({
      ...prev,
      ...(defaults.bassVoice ? { bass: defaults.bassVoice } : {}),
      ...(defaults.drumVoice ? { drums: defaults.drumVoice } : {}),
    }))
    setVoiceSelection((prev) => {
      let next = prev
      if (defaults.bassVoice && defaults.bassVoice.id !== prev.bass) {
        next = { ...next, bass: defaults.bassVoice.id }
      }
      if (defaults.drumVoice && defaults.drumVoice.id !== prev.drums) {
        next = { ...next, drums: defaults.drumVoice.id }
      }
      return next
    })
    setAuditionChannels((prev) => {
      let next = prev
      if (defaults.bassChannel && defaults.bassChannel !== prev.bass) {
        next = { ...next, bass: defaults.bassChannel }
      }
      if (defaults.drumChannel && defaults.drumChannel !== prev.drums) {
        next = { ...next, drums: defaults.drumChannel }
      }
      return next
    })
    if (defaults.drumChannel != null) {
      setDrumChannelSelection(defaults.drumChannel)
    }
  }, [
    donor,
    modelAuditionChoices,
    selectedSection,
    templatePartSnapshots,
    workingMixerForSection,
  ])

  const mixerDirty = dirtyMixerSections.has(sectionMixerKey)

  const canPreviewMinor = selectedSection
    ? sectionSupportsMinorPreview(selectedSection.label)
    : false

  useEffect(() => {
    if (!canPreviewMinor && selectedVariant === "minor") {
      setSelectedVariant("major")
    }
  }, [canPreviewMinor, selectedVariant])

  const activeAuditionInstrument = instrumentForLibTab(libTab)
  const activeAuditionChannel = auditionChannels[activeAuditionInstrument]
  const activeVoiceChoices = useMemo(() => {
    const base =
      modelAuditionChoices?.[activeAuditionInstrument]?.length
        ? modelAuditionChoices[activeAuditionInstrument]!
        : voiceChoicesForInstrument(activeAuditionInstrument)
    const fromStyle = styleLibraryVoices[activeAuditionInstrument]
    const all =
      fromStyle && !base.some((voice) => voice.id === fromStyle.id)
        ? [fromStyle, ...base]
        : base
    if (libTab !== "bass" || !voiceSearch.trim()) return all
    const q = voiceSearch.trim().toLowerCase()
    return all.filter(
      (voice) =>
        voice.id.toLowerCase().includes(q) ||
        voice.label.toLowerCase().includes(q),
    )
  }, [
    activeAuditionInstrument,
    libTab,
    modelAuditionChoices,
    styleLibraryVoices,
    voiceSearch,
  ])
  const activeVoice = useMemo(() => {
    const list = activeVoiceChoices.length
      ? activeVoiceChoices
      : voiceChoicesForInstrument(activeAuditionInstrument)
    const id = voiceSelection[activeAuditionInstrument]
    return (
      list.find((voice) => voice.id === id) ||
      styleLibraryVoices[activeAuditionInstrument] ||
      findVoiceChoice(list, id)
    )
  }, [
    activeAuditionInstrument,
    activeVoiceChoices,
    styleLibraryVoices,
    voiceSelection,
  ])
  const styleBpm = donor?.bpm || 120

  const pushAuditionTempo = (bpm: number) => {
    try {
      session.sendBoth(tempoCommand(bpm))
    } catch {
      /* keyboard may be disconnected mid-session */
    }
  }

  const selectedClip = useMemo(
    () => clips.find((clip) => clip.id === selectedClipId) || null,
    [clips, selectedClipId],
  )

  const loadFacets = useCallback(async () => {
    try {
      const params = new URLSearchParams({ sourceKind: libTab })
      if (libTab === "drums" && genre !== "all") {
        params.set("category", genre)
      }
      const response = await fetch(
        `/api/style-maker/library/facets?${params}`,
      )
      if (!response.ok) return
      const data = await response.json()
      const nextCategories: string[] = data.categories || []
      setCategories(nextCategories)
      setFacetSections(data.sections || [])
      if (
        libTab === "drums" &&
        genre !== "all" &&
        (isExcludedDrumLibraryCategory(genre) ||
          !nextCategories.includes(genre))
      ) {
        setGenre("all")
      }
    } catch {
      /* local facets optional */
    }
  }, [genre, libTab])

  const loadClips = useCallback(async () => {
    setLoadingClips(true)
    try {
      const userAskedForFills = sectionLooksLikeFill(sectionFilter)
      const data = await fetchLibraryClips(libTab, {
        category: genre === "all" ? undefined : genre,
        feelMode: feelMode || undefined,
        sectionType: sectionFilter || undefined,
        q: search.trim() || undefined,
        excludeFillSections: libTab === "drums" && !userAskedForFills,
      })
      let next = data.clips
      if (libTab === "bass" && tempoBand !== 1) {
        next = next.filter((clip) => bassBpmMatchesTempoBand(clip.bpm, tempoBand))
      }
      setClips(next)
      setTotalClips(libTab === "bass" && tempoBand !== 1 ? next.length : data.total)
      setSelectedClipId(next[0]?.id ?? null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Library failed")
      setClips([])
      setTotalClips(0)
    } finally {
      setLoadingClips(false)
    }
  }, [feelMode, genre, libTab, search, sectionFilter, tempoBand])

  useEffect(() => {
    void loadFacets()
  }, [loadFacets])

  useEffect(() => {
    const handle = window.setTimeout(() => void loadClips(), 150)
    return () => window.clearTimeout(handle)
  }, [loadClips])

  useEffect(() => {
    // Reset browse filters when switching library tabs (desktop tab isolation).
    setGenre("all")
    setSectionFilter("")
    setFeelMode("")
    setTempoBand(1)
    setSearch("")
    setVoiceSearch("")
  }, [libTab])

  /**
   * Desktop renderProjectToMidi — apply every section that has takes/mixer,
   * not only the currently selected section.
   */
  const buildCurrentStyleBytes = useCallback((): Uint8Array | null => {
    if (!donor || !styleSections.length) return null

    const sections: StyleSectionLaneReplacements[] = []
    for (const range of styleSections) {
      if (!isAssignableSection(range)) continue
      const key = range.label.trim()
      const laneMap = sectionAssignments[key]
      const minorMap = sectionMinorAssignments[key]
      const lanes: Partial<Record<StyleMakerLane, LaneReplacement>> = {}
      const minorLanes: Partial<Record<StyleMakerLane, LaneReplacement>> = {}
      if (laneMap) {
        for (const lane of ALL_LANES) {
          const a = laneMap[lane]
          if (!a) continue
          lanes[lane] = laneReplacementFromAssignment(
            a,
            guitarCasmModes[lane] ?? StyleMakerGuitarCasmMode.RenderedMegaVoice,
          )
        }
      }
      if (minorMap) {
        for (const lane of ALL_LANES) {
          const m = minorMap[lane]
          if (!m) continue
          minorLanes[lane] = laneReplacementFromAssignment(
            m,
            guitarCasmModes[lane] ?? StyleMakerGuitarCasmMode.RenderedMegaVoice,
          )
        }
      }
      const partMixer =
        (dirtyMixerSections.has(key) && workingPartMixers[key]
          ? workingPartMixers[key]
          : savedPartMixers[key]) || {}
      if (
        !Object.keys(lanes).length &&
        !Object.keys(minorLanes).length &&
        !partMixerHasAny(partMixer)
      ) {
        continue
      }
      sections.push({
        range,
        sectionLabel:
          range.templateSection || yamahaTemplateSectionName(range.label),
        lanes,
        minorLanes,
        partMixer,
      })
    }
    if (!sections.length) return null
    return replaceStyleProjectProduct(donor, sections)
  }, [
    dirtyMixerSections,
    donor,
    guitarCasmModes,
    savedPartMixers,
    sectionAssignments,
    sectionMinorAssignments,
    styleSections,
    workingPartMixers,
  ])

  useEffect(() => {
    try {
      setModified(buildCurrentStyleBytes())
    } catch (error) {
      setModified(null)
      setStatus(
        error instanceof Error ? error.message : "Could not render modified style",
      )
    }
  }, [buildCurrentStyleBytes])

  const flushDirtyPartMixers = useCallback((): Record<string, PartMixerMap> => {
    if (!dirtyMixerSections.size) return savedPartMixers
    const next = { ...savedPartMixers }
    for (const key of dirtyMixerSections) {
      if (workingPartMixers[key]) {
        next[key] = clonePartMixerMap(workingPartMixers[key])
      }
    }
    setSavedPartMixers(next)
    setDirtyMixerSections(new Set())
    return next
  }, [dirtyMixerSections, savedPartMixers, workingPartMixers])

  const buildWorkspaceSnapshot = useCallback(
    (options?: {
      lastBuiltBytes?: Uint8Array | null
      lastBuiltFileName?: string
      partMixers?: Record<string, PartMixerMap>
    }): StyleMakerWorkspaceSnapshot | null => {
      if (!donor || !donorFile) return null
      const sectionRows: Record<string, SectionAssignmentMap> = {}
      for (const [key, map] of Object.entries(sectionAssignments)) {
        const cached = cachedFromLaneMap(map)
        if (Object.keys(cached).length) sectionRows[key] = cached
      }
      const sectionMinorRows: Record<string, SectionAssignmentMap> = {}
      for (const [key, map] of Object.entries(sectionMinorAssignments)) {
        const cached = cachedFromLaneMap(map)
        if (Object.keys(cached).length) sectionMinorRows[key] = cached
      }
      const activeKey = activeSectionKeyRef.current || sectionName.trim()
      return {
        version: 2,
        savedAt: Date.now(),
        donorFileName: donorFile.name,
        donorBytes: donor.originalBytes,
        sectionName,
        bars,
        includeCC,
        selectedLane,
        libTab,
        sectionAssignments: sectionRows,
        sectionMinorAssignments: sectionMinorRows,
        assignments: sectionRows[activeKey] || {},
        minorAssignments: sectionMinorRows[activeKey] || {},
        guitarCasmModes,
        auditionChannels,
        voiceSelection,
        partMixers: options?.partMixers ?? savedPartMixers,
        lastBuiltBytes:
          options?.lastBuiltBytes === undefined
            ? modified || undefined
            : options.lastBuiltBytes || undefined,
        lastBuiltFileName:
          options?.lastBuiltFileName ??
          (options?.lastBuiltBytes || modified
            ? donorFile.name
            : undefined),
        cloudProjectId: cloudProjectIdRef.current,
        cloudProjectName,
      }
    },
    [
      auditionChannels,
      bars,
      cloudProjectName,
      donor,
      donorFile,
      guitarCasmModes,
      includeCC,
      libTab,
      modified,
      savedPartMixers,
      sectionAssignments,
      sectionMinorAssignments,
      sectionName,
      selectedLane,
      voiceSelection,
    ],
  )

  const persistWorkspace = useCallback(
    async (options?: {
      lastBuiltBytes?: Uint8Array | null
      lastBuiltFileName?: string
      partMixers?: Record<string, PartMixerMap>
    }) => {
      const snapshot = buildWorkspaceSnapshot(options)
      if (!snapshot) {
        await clearStyleMakerDraft({
          userId: accountUserIdRef.current,
          projectId: cloudProjectIdRef.current,
        })
        await clearStyleMakerDraft({
          userId: accountUserIdRef.current,
          projectId: null,
        })
        return
      }
      await saveStyleMakerDraft(
        {
          userId: accountUserIdRef.current,
          projectId: cloudProjectIdRef.current,
        },
        snapshot,
      )
    },
    [buildWorkspaceSnapshot],
  )

  // Mark the open project dirty whenever in-memory takes/mixers change.
  useEffect(() => {
    if (!workspaceReady.current || !workspaceHydrated || !donor) return
    if (suppressDirtyRef.current) return
    setProjectDirty(true)
  }, [
    donor,
    sectionAssignments,
    sectionMinorAssignments,
    savedPartMixers,
    workingPartMixers,
    dirtyMixerSections,
    guitarCasmModes,
    workspaceHydrated,
  ])

  // Local draft whenever the workspace changes (cloud save is explicit).
  useEffect(() => {
    if (!workspaceReady.current || !workspaceHydrated) return
    const handle = window.setTimeout(() => {
      void persistWorkspace().catch(() => {
        /* quota / private mode */
      })
    }, 350)
    return () => window.clearTimeout(handle)
  }, [persistWorkspace, workspaceHydrated])

  const refreshProjectList = useCallback(async () => {
    try {
      setProjectList(await listStyleMakerProjects())
    } catch {
      /* offline / unentitled */
    }
  }, [])

  const stopPreview = () => {
    preview.current?.stop()
    setPreviewing(false)
  }

  const workspaceHasContent = Boolean(
    donor ||
      countAllSectionTakes(sectionAssignments, sectionMinorAssignments) > 0 ||
      Object.keys(savedPartMixers).length > 0 ||
      Object.keys(workingPartMixers).length > 0 ||
      dirtyMixerSections.size > 0 ||
      modified,
  )

  /**
   * Load a donor from disk after clearing the current Style Maker project
   * (takes, mixers, built bytes, IndexedDB workspace).
   */
  const importTemplateFresh = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const parsed = parseYamahaStyle(bytes)
      if (!parsed.yamahaTail.length) {
        throw new Error("Upload a native Yamaha .sty/.prs/.sst/.fps with CASM intact.")
      }
      const sectionsInFile = extractStyleSections(parsed)
      if (!sectionsInFile.length) {
        throw new Error("This style has no Intro/Main/Fill/Ending markers.")
      }
      const preferred =
        sectionsInFile.find(isMainSection) || sectionsInFile[0]
      stopPreview()
      const previousId = cloudProjectIdRef.current
      await clearStyleMakerDraft({
        userId: accountUserIdRef.current,
        projectId: previousId,
      })
      await clearStyleMakerDraft({
        userId: accountUserIdRef.current,
        projectId: null,
      })
      await clearLegacyStyleMakerWorkspace()
      setDonorFile(file)
      setDonor(parsed)
      setModified(null)
      setSectionName(preferred.label.trim())
      setSectionAssignments({})
      setSectionMinorAssignments({})
      setGuitarCasmModes({})
      setStyleLibraryVoices({})
      setSavedPartMixers({})
      setWorkingPartMixers({})
      setDirtyMixerSections(new Set())
      setSelectedLane(StyleMakerLane.Rhythm1)
      setSelectedVariant("major")
      setPianoRollTarget(null)
      setCloudProjectId(null)
      setCloudProjectName(null)
      setProjectDirty(true)
      setStatus(
        `Template loaded: ${file.name} · ${sectionsInFile.length} sections · ${parsed.bpm} BPM — Preview Major holds C, Preview Minor holds Am`,
      )
    } catch (error) {
      setDonor(null)
      setDonorFile(null)
      setStatus(error instanceof Error ? error.message : "Template could not be read")
      toast.error(error instanceof Error ? error.message : "Template could not be read")
    }
  }

  /** File-picker entry: confirm before wiping an existing project. */
  const requestImportTemplate = (file: File) => {
    if (!workspaceHasContent) {
      void importTemplateFresh(file)
      return
    }
    setPendingTemplateImport({ file })
  }

  const finishTemplateImportPrompt = (accepted: boolean) => {
    const pending = pendingTemplateImport
    setPendingTemplateImport(null)
    if (!accepted || !pending) {
      setStatus("Style import cancelled — current project kept.")
      return
    }
    void importTemplateFresh(pending.file)
  }

  const setAuditionChannel = (instrument: AuditionInstrument, channel: number) => {
    setAuditionChannels((prev) => ({
      ...prev,
      [instrument]: clampMidiChannel(channel),
    }))
  }

  const setInstrumentVoice = (instrument: AuditionInstrument, voiceId: string) => {
    setVoiceSelection((prev) => ({ ...prev, [instrument]: voiceId }))
    if (!midi.connected) return
    const list =
      modelAuditionChoices?.[instrument]?.length
        ? modelAuditionChoices[instrument]!
        : voiceChoicesForInstrument(instrument)
    const voice = findVoiceChoice(list, voiceId)
    const channel = auditionChannels[instrument]
    try {
      sendXgPartVoice(session, channel, voice)
      setStatus(`Voice → ${voice.label} on ch ${channel}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Voice change failed")
    }
  }

  const applyCurrentSectionMixerToHardware = useCallback(
    (
      mixer: PartMixerMap,
      snapshots?: Partial<Record<StyleMakerLane, TemplatePartSnapshot>>,
    ) => {
      if (!midi.connected) return
      try {
        applyPartMixerToHardware(
          session,
          mixer,
          snapshots ?? templatePartSnapshots,
        )
      } catch {
        /* disconnected mid-edit */
      }
    },
    [midi.connected, session, templatePartSnapshots],
  )

  const markMixerDirty = useCallback((sectionKey: string) => {
    setDirtyMixerSections((prev) => {
      const next = new Set(prev)
      next.add(sectionKey)
      return next
    })
  }, [])

  /** Desktop AuditionTab::saveCurrentSectionMix */
  const saveSectionMix = useCallback(
    (sectionKey: string) => {
      if (!sectionKey) return
      const result = commitSectionPartMixer(
        workingPartMixers,
        savedPartMixers,
        sectionKey,
      )
      if (!result) return
      setWorkingPartMixers(result.working)
      setSavedPartMixers(result.saved)
      setDirtyMixerSections((prev) => {
        const next = new Set(prev)
        next.delete(sectionKey)
        return next
      })
      // Desktop: section->partMixer = working; audition.setProject(project);
      // if wasAuditioning → playSection (re-applies committed mixer).
      applyCurrentSectionMixerToHardware(result.mixer, templatePartSnapshots)
      setStatus(`Mixer edits are saved for ${sectionKey}`)
    },
    [
      applyCurrentSectionMixerToHardware,
      savedPartMixers,
      templatePartSnapshots,
      workingPartMixers,
    ],
  )

  /** Desktop AuditionTab section combo onChange */
  const onMixerSectionChange = useCallback(
    (name: string) => {
      if (!name) return
      const section =
        styleSections.find(
          (row) => row.label.trim().toLowerCase() === name.toLowerCase(),
        ) || null
      const snapshots =
        donor && section ? extractSectionPartSnapshots(donor, section) : {}

      // setActiveSectionName + refreshRows (React) + updateAuditionProject / hardware
      setSectionName(name)
      setWorkingPartMixers((prev) => {
        const { working, mixer } = selectSectionMixer(
          prev,
          savedPartMixers,
          name,
        )
        applyCurrentSectionMixerToHardware(mixer, snapshots)
        return working
      })
      setStatus(
        dirtyMixerSections.has(name)
          ? `Unsaved mixer changes for ${name}`
          : `Mixer edits are saved for ${name}`,
      )
    },
    [
      applyCurrentSectionMixerToHardware,
      dirtyMixerSections,
      donor,
      savedPartMixers,
      styleSections,
    ],
  )

  const onPartValueChange = useCallback(
    (
      lane: StyleMakerLane,
      field: "volume" | "pan" | "reverb" | "chorus",
      value: number,
    ) => {
      const key = sectionMixerKey
      if (!key) return
      setWorkingPartMixers((prev) => {
        const ensured = ensureWorkingMixer(prev, savedPartMixers, key)
        const patch =
          field === "volume"
            ? { volume: value, hasVolume: true }
            : field === "pan"
              ? { pan: value, hasPan: true }
              : field === "reverb"
                ? { reverb: value, hasReverb: true }
                : { chorus: value, hasChorus: true }
        const nextMap = upsertWorkingLane(ensured[key] || {}, lane, patch)
        const next = { ...ensured, [key]: nextMap }
        applyCurrentSectionMixerToHardware(nextMap)
        return next
      })
      markMixerDirty(key)
    },
    [
      applyCurrentSectionMixerToHardware,
      markMixerDirty,
      savedPartMixers,
      sectionMixerKey,
    ],
  )

  const onMixerVoiceSelected = useCallback(
    (
      lane: StyleMakerLane,
      voice: {
        msb: number
        lsb: number
        programYamaha: number
        name: string
      },
    ) => {
      const key = sectionMixerKey
      if (!key) return
      setWorkingPartMixers((prev) => {
        const ensured = ensureWorkingMixer(prev, savedPartMixers, key)
        const nextMap = upsertWorkingLane(ensured[key] || {}, lane, {
          hasVoice: true,
          voiceMSB: voice.msb,
          voiceLSB: voice.lsb,
          voiceProgram: voice.programYamaha,
          voiceName: voice.name,
        })
        const next = { ...ensured, [key]: nextMap }
        applyCurrentSectionMixerToHardware(nextMap)
        return next
      })
      markMixerDirty(key)
      setStatus(`Voice → ${voice.name} on ${laneRowTitle(lane)}`)
    },
    [
      applyCurrentSectionMixerToHardware,
      markMixerDirty,
      savedPartMixers,
      sectionMixerKey,
    ],
  )

  const onCopyVoicesToAllSections = useCallback(() => {
    const key = sectionMixerKey
    if (!key) return
    const sectionNames = styleSections.length
      ? styleSections.map((section) => section.label.trim()).filter(Boolean)
      : [key]
    setWorkingPartMixers((prev) => {
      const result = copyCurrentSectionVoicesToAllSections(
        prev,
        savedPartMixers,
        sectionNames,
        key,
      )
      setDirtyMixerSections((prevDirty) => {
        const merged = new Set(prevDirty)
        for (const name of result.dirtySectionNames) merged.add(name)
        return merged
      })
      setStatus(
        result.copiedVoiceCount > 0
          ? `Copied ${result.copiedVoiceCount} voice(s) from ${key} to all sections`
          : `No voices set on ${key} to copy`,
      )
      applyCurrentSectionMixerToHardware(result.working[key] || {})
      return result.working
    })
  }, [
    applyCurrentSectionMixerToHardware,
    savedPartMixers,
    sectionMixerKey,
    styleSections,
  ])

  const resolveClipAuditionChannel = (clip: LibraryClipMeta) => {
    if (libTab === "drums") {
      return resolveDrumAuditionChannel(drumChannelSelection, clip.categoryName)
    }
    return auditionChannels[activeAuditionInstrument]
  }

  const auditionClip = async (clip: LibraryClipMeta) => {
    if (!midi.connected) {
      toast.error("Connect the keyboard first.")
      return
    }
    try {
      setSelectedClipId(clip.id)
      const bytes = await fetchClipMidi(clip.id)
      const channel = resolveClipAuditionChannel(clip)
      const voice = activeVoice
      let { events, ticksPerQuarter, barCount } = extractClipAuditionEvents(
        bytes,
        channel,
      )
      if (libTab === "bass") {
        let bassProfileIndex = findBassProfileIndexByName(
          activeVoice.label || voiceSelection.bass || "ElectricBass",
        )
        if (bassProfileIndex < 0) {
          bassProfileIndex = findBassProfileIndexByBank(
            activeVoice.msb,
            activeVoice.lsb,
            activeVoice.programYamaha,
          )
        }
        events = applyBassAuditionEventTransforms(events, {
          timeFeelFactor: timeFeelFactor(bassTimeFeel),
          sustainVelocityDelta: bassVel,
          deadVelocityDelta: bassDead,
          targetProfileIndex:
            bassProfileIndex >= 0 ? bassProfileIndex : undefined,
        })
        const lastTick = Math.max(0, ...events.map((event) => event.tick))
        const barTicks = ticksPerQuarter * 4
        barCount = Math.max(1, Math.ceil((lastTick + 1) / barTicks))
      }
      let effectiveDrumMap: DrumMappingMode = "gm"
      if (libTab === "drums") {
        effectiveDrumMap = resolveDrumMappingMode(
          drumMapping,
          clip.categoryName,
          isGenosFamilyProfileId(midi.profile?.id),
        )
        events = applyDrumMappingToEvents(events, effectiveDrumMap)
      }
      // Prefer style BPM when a donor is loaded (Style Maker context).
      const bpm = Math.max(40, Math.round(donor?.bpm || clip.bpm || 120))
      const chord =
        libTab === "drums" ? undefined : auditionChordForPreview(false)
      pushAuditionTempo(bpm)
      preview.current?.play(events, ticksPerQuarter, bpm, barCount + 1, {
        holdChord: chord,
        port: "port2",
        setupMessages: xgVoiceSetupMessages(channel, voice),
      })
      setPreviewing(true)
      setStatus(
        `Auditioning “${formatClipTitle(clip.clipName, clip.id)}” · ${voice.label} on ch ${channel} · ${bpm} BPM${
          chord ? ` · ${chord}` : ""
        }${libTab === "drums" ? ` · ${effectiveDrumMap === "ambient" ? "Ambient" : "GM"} map` : ""}`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Clip audition failed")
    }
  }

  const scaleNotesToDonor = (
    notes: MidiNote[],
    cycleTicks: number,
    clipTpq: number,
  ): { notes: MidiNote[]; cycleTicks: number } => {
    if (!donor) return { notes, cycleTicks }
    const ratio = donor.ticksPerQuarter / clipTpq
    return {
      notes: notes.map((note) => ({
        ...note,
        tick: Math.round(note.tick * ratio),
        duration: Math.max(1, Math.round(note.duration * ratio)),
      })),
      cycleTicks: Math.round(cycleTicks * ratio),
    }
  }

  const askPartType = (
    lane: StyleMakerLane,
    clipName: string,
    sourceKind: string,
  ): Promise<{
    sourceKind: string
    guitarMode: StyleMakerGuitarCasmMode
  } | null> => {
    if (!laneNeedsPartTypePrompt(lane)) {
      return Promise.resolve({
        sourceKind,
        guitarMode: StyleMakerGuitarCasmMode.RenderedMegaVoice,
      })
    }
    return new Promise((resolve) => {
      setPartTypePrompt({
        lane,
        clipName,
        sourceKind,
        selectedIndex: defaultPartTypeIndex(lane, sourceKind),
        resolve,
      })
    })
  }

  const assignClipToLane = async (
    lane: StyleMakerLane,
    clip: LibraryClipMeta,
    variant: ChordVariant = "major",
  ) => {
    if (!donor) {
      toast.error("Import a style template first.")
      return
    }
    try {
      const initialKind = sourceKindForLibraryTab(
        (clip.sourceKind as LibraryTab) || libTab,
      )
      const choice = await askPartType(
        lane,
        formatClipTitle(clip.clipName, clip.id),
        initialKind,
      )
      if (!choice) return

      const accepted = laneAccepts(lane, choice.sourceKind)
      if (!accepted.ok) {
        toast.error(accepted.warning || "Cannot assign to this lane.")
        return
      }
      if (
        choice.sourceKind === "guitar" &&
        isYamahaGuitarSourceMode(choice.guitarMode)
      ) {
        toast.error(
          `${displayName(lane)}: ${guitarCasmModeName(choice.guitarMode)} requires a frozen/imported Yamaha Guitar-source MIDI take. Normal rendered guitar MIDI must use Rendered MegaVoice performance.`,
        )
        return
      }

      const bytes = await fetchClipMidi(clip.id)
      const extracted = extractMidiNotes(bytes)
      let scaled = scaleNotesToDonor(
        extracted.notes,
        extracted.cycleTicks,
        extracted.ticksPerQuarter,
      )
      // Bass: Time / Vel / Dead + MegaVoice remap (same order as desktop apply).
      if (choice.sourceKind === "bass" || clip.sourceKind === "bass") {
        const bassVoice = findVoiceChoice(
          modelAuditionChoices?.bass?.length
            ? modelAuditionChoices.bass
            : voiceChoicesForInstrument("bass"),
          voiceSelection.bass || "ElectricBass",
        )
        const styleBass = styleLibraryVoices.bass
        const voiceForProfile =
          styleBass && styleBass.id === voiceSelection.bass
            ? styleBass
            : bassVoice
        let bassProfileIndex = findBassProfileIndexByName(
          voiceForProfile.label || voiceSelection.bass || "ElectricBass",
        )
        if (bassProfileIndex < 0) {
          bassProfileIndex = findBassProfileIndexByBank(
            voiceForProfile.msb,
            voiceForProfile.lsb,
            voiceForProfile.programYamaha,
          )
        }
        const transformed = applyBassAuditionTransforms(scaled.notes, {
          timeFeelFactor: timeFeelFactor(bassTimeFeel),
          sustainVelocityDelta: bassVel,
          deadVelocityDelta: bassDead,
          targetProfileIndex:
            bassProfileIndex >= 0 ? bassProfileIndex : undefined,
        })
        const factor = timeFeelFactor(bassTimeFeel)
        scaled = {
          notes: transformed,
          cycleTicks: Math.max(1, Math.round(scaled.cycleTicks * factor)),
        }
      }
      // Drums: Ambient/GM hat remap (LibraryPhraseService::extractAndRemapDrumNotesOnly).
      if (choice.sourceKind === "drums" || clip.sourceKind === "drums") {
        const mode = resolveDrumMappingMode(
          drumMapping,
          clip.categoryName,
          isGenosFamilyProfileId(midi.profile?.id),
        )
        scaled = {
          ...scaled,
          notes: applyDrumMappingToNotes(scaled.notes, mode),
        }
      }
      const nextAssignment: LaneAssignment = {
        title: clip.clipName || `Clip ${clip.id}`,
        subtitle: [
          clip.categoryName,
          clip.feelMode || clip.feelName,
          clip.sectionType,
          clip.bpm ? `${Math.round(clip.bpm)} BPM` : null,
          choice.sourceKind,
        ]
          .filter(Boolean)
          .join(" · "),
        notes: scaled.notes,
        cycleTicks: scaled.cycleTicks,
        origin: "library",
        clipId: clip.id,
        sourceKind: choice.sourceKind,
        frozen: false,
      }
      setGuitarCasmModes((prev) => ({
        ...prev,
        [lane]: choice.guitarMode,
      }))
      setSelectedLane(lane)
      setSelectedVariant(variant)
      if (variant === "minor") {
        setMinorAssignments((prev) => ({ ...prev, [lane]: nextAssignment }))
      } else {
        setAssignments((prev) => ({ ...prev, [lane]: nextAssignment }))
      }
      setStatus(
        `Assigned “${clip.clipName || clip.id}” to ${displayName(lane)} ${
          variant === "minor" ? "MIN" : "MAJ"
        } (${choice.sourceKind})`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Clip load failed")
    }
  }

  const assignSelectedClip = async () => {
    if (!selectedClip) {
      toast.error("Select a clip in the library first.")
      return
    }
    await assignClipToLane(selectedLane, selectedClip, selectedVariant)
  }

  const parseDraggedClip = (event: React.DragEvent): LibraryClipMeta | null => {
    const raw =
      event.dataTransfer.getData(CLIP_DND_TYPE) ||
      event.dataTransfer.getData("text/plain")
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as LibraryClipMeta
      if (!parsed || typeof parsed.id !== "number") return null
      return parsed
    } catch {
      return null
    }
  }

  const onLaneDragOver = (
    event: React.DragEvent,
    lane: StyleMakerLane,
    variant: ChordVariant = "major",
  ) => {
    const hasClip = dragHasLibraryClip(event.dataTransfer)
    const hasFiles = dragHasExternalFiles(event.dataTransfer)
    if (!hasClip && !hasFiles) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    const kind = hasClip ? "clip" : "midi"
    if (dropLane !== lane || dropKind !== kind || dropVariant !== variant) {
      setDropLane(lane)
      setDropKind(kind)
      setDropVariant(variant)
    }
  }

  const onLaneDrop = (
    event: React.DragEvent,
    lane: StyleMakerLane,
    variant: ChordVariant = "major",
  ) => {
    event.preventDefault()
    setDropLane(null)
    setDropKind(null)
    setDropVariant(null)
    setSelectedLane(lane)
    setSelectedVariant(variant)

    const midiFile = midiFileFromDataTransfer(event.dataTransfer)
    if (midiFile) {
      void importMidiFileToLane(lane, midiFile, variant)
      return
    }
    if (dragHasExternalFiles(event.dataTransfer)) {
      toast.error("Drop a .mid or .midi file onto a lane.")
      return
    }

    const clip = parseDraggedClip(event)
    if (!clip) {
      toast.error("Could not read the dragged clip.")
      return
    }
    setSelectedClipId(clip.id)
    void assignClipToLane(lane, clip, variant)
  }

  const clearLane = (lane: StyleMakerLane, variant?: ChordVariant) => {
    if (variant === "minor") {
      setMinorAssignments((prev) => ({ ...prev, [lane]: null }))
      setStatus(`Cleared ${displayName(lane)} MIN`)
      return
    }
    // Desktop clearLane (major): clears major + minor.
    setAssignments((prev) => ({ ...prev, [lane]: null }))
    setMinorAssignments((prev) => ({ ...prev, [lane]: null }))
    setGuitarCasmModes((prev) => {
      const next = { ...prev }
      delete next[lane]
      return next
    })
    setStatus(`Cleared ${displayName(lane)}`)
  }

  const clearAll = () => {
    // Desktop clears the active section recipe only.
    setAssignments(emptyAssignments())
    setMinorAssignments(emptyAssignments())
    setStatus(`Cleared all lanes on ${activeSectionKey || "section"}`)
  }

  /**
   * Desktop BuildTab::importMidiFileToLane — Cubase / DAW .mid drop onto a lane.
   * Bytes are frozen (never re-rendered); sourceCategory labeled Cubase MIDI.
   */
  const importMidiFileToLane = async (
    lane: StyleMakerLane,
    file: File,
    variant: ChordVariant = "major",
  ) => {
    if (!donor) {
      toast.error("Import a style template first.")
      return
    }
    if (!isMidiFileName(file.name)) {
      toast.error("Drop a .mid or .midi file onto a lane.")
      return
    }
    try {
      const displayNameRaw = file.name.replace(/\.(mid|midi)$/i, "")
      const choice = await askPartType(
        lane,
        displayNameRaw,
        sourceKindForLane(lane),
      )
      if (!choice) return

      const accepted = laneAccepts(lane, choice.sourceKind)
      if (!accepted.ok) {
        toast.error(accepted.warning || "Cannot import MIDI to this lane.")
        return
      }

      const extracted = extractMidiNotes(new Uint8Array(await file.arrayBuffer()))
      if (!extracted.notes.length) {
        toast.error("MIDI file has no notes.")
        return
      }
      const scaled = scaleNotesToDonor(
        extracted.notes,
        extracted.cycleTicks,
        extracted.ticksPerQuarter,
      )
      const nextAssignment: LaneAssignment = {
        title: displayNameRaw,
        subtitle: `Cubase MIDI · ${choice.sourceKind}`,
        notes: scaled.notes,
        cycleTicks: scaled.cycleTicks,
        origin: "upload",
        sourceKind: choice.sourceKind,
        frozen: true,
      }
      setGuitarCasmModes((prev) => ({
        ...prev,
        [lane]: choice.guitarMode,
      }))
      setSelectedLane(lane)
      setSelectedVariant(variant)
      if (variant === "minor") {
        setMinorAssignments((prev) => ({ ...prev, [lane]: nextAssignment }))
      } else {
        setAssignments((prev) => ({ ...prev, [lane]: nextAssignment }))
      }
      setStatus(
        `Imported ${file.name} to ${displayName(lane)} ${
          variant === "minor" ? "MIN" : "MAJ"
        } in ${sectionName}`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "MIDI could not be read")
    }
  }

  const openPianoRoll = (
    lane: StyleMakerLane,
    variant: ChordVariant = "major",
  ) => {
    if (!donor || !selectedSection) {
      toast.error("Import a style template first.")
      return
    }
    const minor = variant === "minor"
    const assignment = minor ? minorAssignments[lane] : assignments[lane]
    const templateNotes =
      !assignment
        ? extractLaneTemplateNotes(donor, selectedSection, lane, minor)
        : []
    const notes = assignment?.notes?.length
      ? assignment.notes.map((note) => ({ ...note }))
      : templateNotes.map((note) => ({ ...note }))
    const sectionTicks = Math.max(
      1,
      selectedSection.endTick - selectedSection.startTick,
    )
    const cycleTicks = Math.max(
      assignment?.cycleTicks || 0,
      sectionTicks,
      donor.ticksPerQuarter * 4,
      ...notes.map((note) => note.tick + note.duration),
      1,
    )
    setSelectedLane(lane)
    setSelectedVariant(variant)
    setPianoRollTarget({
      lane,
      variant,
      sectionLabel: selectedSection.label,
      notes,
      cycleTicks,
      ticksPerQuarter: donor.ticksPerQuarter,
      bpm: styleBpm,
    })
    setStatus(
      `Editing ${displayName(lane)} ${minor ? "MIN" : "MAJ"} piano roll`,
    )
  }

  const applyPianoRoll = (notes: MidiNote[], cycleTicks: number) => {
    if (!pianoRollTarget) return
    const { lane, variant } = pianoRollTarget
    const minor = variant === "minor"
    const previous = minor ? minorAssignments[lane] : assignments[lane]
    const baseTitle = previous?.title?.replace(/\s*\(edited\)\s*$/i, "").trim()
    const nextAssignment: LaneAssignment = {
      title: `${baseTitle || displayName(lane)} (edited)`,
      subtitle: previous?.subtitle || sectionName,
      notes,
      cycleTicks: Math.max(1, cycleTicks),
      origin: previous?.origin ?? "upload",
      clipId: previous?.clipId,
      sourceKind: previous?.sourceKind || sourceKindForLane(lane),
      frozen: previous?.frozen ?? false,
    }
    if (minor) {
      setMinorAssignments((prev) => ({ ...prev, [lane]: nextAssignment }))
    } else {
      setAssignments((prev) => ({ ...prev, [lane]: nextAssignment }))
    }
    preview.current?.stop()
    setPianoRollTarget(null)
    setStatus(
      `Applied piano-roll edits to ${displayName(lane)} ${
        minor ? "MIN" : "MAJ"
      }`,
    )
    toast.success("Lane MIDI updated")
  }

  const playLane = (lane: StyleMakerLane, variant: ChordVariant = "major") => {
    if (!midi.connected || !donor || !selectedSection) {
      toast.error("Connect the keyboard and import a template first.")
      return
    }
    try {
      const minor = variant === "minor"
      const assignment = minor ? minorAssignments[lane] : assignments[lane]
      const chord = auditionChordForPreview(minor)
      // Only a take with notes overrides the donor; empty/stale rows use template.
      const events =
        assignment?.notes?.length
          ? notesToAuditionEvents(assignment.notes, styleChannel(lane))
          : extractLaneAuditionEvents(donor, selectedSection, lane, minor)
      if (!events.length) {
        toast.error(
          `No ${minor ? "minor" : "major"} MIDI for ${displayName(lane)} in ${selectedSection.label}.`,
        )
        return
      }
      const sectionBars = Math.max(
        1,
        Math.ceil(
          (selectedSection.endTick - selectedSection.startTick) /
            (donor.ticksPerQuarter * 4),
        ),
      )
      pushAuditionTempo(styleBpm)
      preview.current?.play(
        events,
        donor.ticksPerQuarter,
        styleBpm,
        Math.max(bars, sectionBars),
        { holdChord: chord },
      )
      setPreviewing(true)
      setStatus(
        `Previewing ${displayName(lane)} ${minor ? "MIN" : "MAJ"} · ${
          assignment?.notes?.length ? assignment.title : "original template"
        } · ${chord} · ${styleBpm} BPM`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lane preview failed")
    }
  }

  const playSelectedClip = async () => {
    if (!selectedClip) {
      toast.error("Select a clip in the library first.")
      return
    }
    await auditionClip(selectedClip)
  }

  const playSection = (minor: boolean) => {
    if (!midi.connected || !donor || !selectedSection) {
      toast.error("Connect the keyboard and import a template first.")
      return
    }
    if (minor && !sectionSupportsMinorPreview(selectedSection.label)) {
      toast.error("Preview Minor is for Intro / Ending sections.")
      return
    }
    try {
      const chord = auditionChordForPreview(minor)
      const majorTakes: Partial<Record<StyleMakerLane, MidiNote[]>> = {}
      const minorTakes: Partial<Record<StyleMakerLane, MidiNote[]>> = {}
      for (const lane of ALL_LANES) {
        const major = assignments[lane]
        if (major?.notes?.length) majorTakes[lane] = major.notes
        const minorTake = minorAssignments[lane]
        if (minorTake?.notes?.length) minorTakes[lane] = minorTake.notes
      }
      const hasTakes =
        Object.keys(majorTakes).length > 0 || Object.keys(minorTakes).length > 0
      // With no takes, always audition the raw donor (not a stale rebuilt style).
      // Major preview can use the rebuilt style when only major takes exist;
      // minor always auditions donor + takes (desktop minor path).
      const parsed =
        !minor &&
        hasTakes &&
        modified &&
        Object.keys(minorTakes).length === 0
          ? parseYamahaStyle(modified)
          : donor
      const events = extractSectionAuditionEventsWithTakes(
        parsed,
        selectedSection,
        minor,
        majorTakes,
        minorTakes,
      )
      const bpm = Math.max(40, Math.round(parsed.bpm || donor.bpm || 120))
      const sectionBars = Math.max(
        1,
        Math.ceil(
          (selectedSection.endTick - selectedSection.startTick) /
            (parsed.ticksPerQuarter * 4),
        ),
      )
      applyCurrentSectionMixerToHardware(workingMixerForSection)
      pushAuditionTempo(bpm)
      preview.current?.play(
        events,
        parsed.ticksPerQuarter,
        bpm,
        Math.max(bars, sectionBars),
        { holdChord: chord },
      )
      setPreviewing(true)
      setStatus(
        `Preview ${minor ? "Minor" : "Major"} · ${selectedSection.label} · ${chord} · ${bpm} BPM`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Section preview failed")
    }
  }

  const prepareSnapshotForCloud = () => {
    if (!donorFile || !donor) {
      throw new Error("Import a style template first.")
    }
    const flushedMixers = flushDirtyPartMixers()
    let built: Uint8Array | null = null
    try {
      built = buildCurrentStyleBytes()
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error("Could not build style")
    }
    if (built) setModified(built)
    const snapshot = buildWorkspaceSnapshot({
      lastBuiltBytes: built,
      lastBuiltFileName: built ? donorFile.name : undefined,
      partMixers: flushedMixers,
    })
    if (!snapshot) throw new Error("Nothing to save.")
    return { snapshot, built, flushedMixers }
  }

  const saveProjectToCloud = async (name: string, asNew: boolean) => {
    const { snapshot, built, flushedMixers } = prepareSnapshotForCloud()
    const body = writeBodyFromSnapshot(name, snapshot)
    setProjectBusy(true)
    try {
      const saved =
        !asNew && cloudProjectId
          ? await updateStyleMakerProject(cloudProjectId, body)
          : await createStyleMakerProject(body)
      suppressDirtyRef.current = true
      setCloudProjectId(saved.id)
      setCloudProjectName(saved.name)
      setProjectDirty(false)
      window.setTimeout(() => {
        suppressDirtyRef.current = false
      }, 0)
      await clearLegacyStyleMakerWorkspace()
      await saveStyleMakerDraft(
        { userId: accountUserIdRef.current, projectId: saved.id },
        {
          ...snapshot,
          cloudProjectId: saved.id,
          cloudProjectName: saved.name,
        },
      )
      // Drop unsaved draft slot once the project has an id.
      await clearStyleMakerDraft({
        userId: accountUserIdRef.current,
        projectId: null,
      })
      await refreshProjectList()
      const laneCount = countAllSectionTakes(
        sectionAssignments,
        sectionMinorAssignments,
      )
      setStatus(
        `Saved “${saved.name}” to your account · ${laneCount} take(s) · ${
          Object.keys(flushedMixers).length
        } section mix(es)${built ? " · style built" : ""}`,
      )
      toast.success(`Saved “${saved.name}” to your account`)
      return saved
    } finally {
      setProjectBusy(false)
    }
  }

  /**
   * Explicit Save: update open cloud project, or prompt Save As when unnamed.
   */
  const saveWorkspaceNow = async () => {
    if (!donorFile || !donor) {
      toast.error("Import a style template first.")
      return
    }
    if (!cloudProjectId || !cloudProjectName) {
      setSaveAsPrompt({
        name: sanitizeProjectName(
          donorFile.name.replace(/\.(sty|prs|sst|fps)$/i, "") || "My Style Project",
        ),
        mode: "save-as",
      })
      return
    }
    try {
      await saveProjectToCloud(cloudProjectName, false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save project",
      )
    }
  }

  const beginSaveAs = () => {
    if (!donorFile || !donor) {
      toast.error("Import a style template first.")
      return
    }
    setSaveAsPrompt({
      name: sanitizeProjectName(
        cloudProjectName ||
          donorFile.name.replace(/\.(sty|prs|sst|fps)$/i, "") ||
          "My Style Project",
      ),
      mode: "save-as",
    })
  }

  const finishSaveAsPrompt = async (accepted: boolean) => {
    const pending = saveAsPrompt
    setSaveAsPrompt(null)
    if (!accepted || !pending) {
      if (pending?.mode === "migrate") {
        setStatus("Kept browser draft only — save to your account anytime.")
      }
      return
    }
    try {
      await saveProjectToCloud(pending.name, true)
      if (pending.mode === "migrate") {
        await clearLegacyStyleMakerWorkspace()
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save project",
      )
    }
  }

  const openCloudProject = async (id: string) => {
    setProjectBusy(true)
    try {
      const wire = await getStyleMakerProject(id)
      const snapshot = snapshotFromProjectWire(wire)
      stopPreview()
      applyWorkspaceSnapshot(snapshot, {
        cloudId: wire.id,
        cloudName: wire.name,
      })
      setProjectDirty(false)
      await saveStyleMakerDraft(
        { userId: accountUserIdRef.current, projectId: wire.id },
        {
          ...snapshot,
          cloudProjectId: wire.id,
          cloudProjectName: wire.name,
        },
      )
      setOpenProjectModal(false)
      setPendingOpenProjectId(null)
      setStatus(`Opened “${wire.name}” from your account`)
      toast.success(`Opened “${wire.name}”`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not open project",
      )
    } finally {
      setProjectBusy(false)
    }
  }

  const requestOpenProject = (id: string) => {
    if (projectDirty && donor) {
      setPendingOpenProjectId(id)
      return
    }
    void openCloudProject(id)
  }

  const confirmOpenProject = (accepted: boolean) => {
    const id = pendingOpenProjectId
    setPendingOpenProjectId(null)
    if (!accepted || !id) return
    void openCloudProject(id)
  }

  const beginOpenProjects = async () => {
    setProjectBusy(true)
    try {
      await refreshProjectList()
      setOpenProjectModal(true)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not list projects",
      )
    } finally {
      setProjectBusy(false)
    }
  }

  const finishDeleteProject = async (accepted: boolean) => {
    setDeleteProjectPrompt(false)
    if (!accepted || !cloudProjectId) return
    const id = cloudProjectId
    const name = cloudProjectName || "project"
    setProjectBusy(true)
    try {
      await deleteStyleMakerProject(id)
      await clearStyleMakerDraft({
        userId: accountUserIdRef.current,
        projectId: id,
      })
      setCloudProjectId(null)
      setCloudProjectName(null)
      setDonor(null)
      setDonorFile(null)
      setModified(null)
      setSectionAssignments({})
      setSectionMinorAssignments({})
      setSavedPartMixers({})
      setWorkingPartMixers({})
      setDirtyMixerSections(new Set())
      setProjectDirty(false)
      await refreshProjectList()
      setStatus(`Deleted “${name}” from your account`)
      toast.success(`Deleted “${name}”`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete project",
      )
    } finally {
      setProjectBusy(false)
    }
  }

  const exportFile = () => {
    if (!donorFile) {
      toast.error("Nothing to export yet.")
      return
    }
    const flushedMixers = flushDirtyPartMixers()
    let built: Uint8Array | null
    try {
      built = buildCurrentStyleBytes()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build style")
      return
    }
    if (!built) {
      toast.error("Assign clips or save a section mix first.")
      return
    }
    setModified(built)
    const bytes = new Uint8Array(built.length)
    bytes.set(built)
    const blob = new Blob([bytes.buffer], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `SmartBridge_${donorFile.name}`
    anchor.click()
    URL.revokeObjectURL(url)
    void persistWorkspace({
      lastBuiltBytes: built,
      lastBuiltFileName: donorFile.name,
      partMixers: flushedMixers,
    }).catch(() => {})
    setStatus(`Exported SmartBridge_${donorFile.name}`)
  }

  const beginTransferToKeyboard = () => {
    if (!buildCurrentStyleBytes()) {
      toast.error("Assign clips or save a section mix first.")
      return
    }
    if (!midi.connected || !midi.profile) {
      toast.error("Connect a supported Yamaha keyboard and finish the style first.")
      return
    }
    setTransferNamePrompt({
      name: styleStemFromFileName(donorFile?.name),
    })
  }

  /**
   * Rebuild + persist the style, then Musicsoft-transfer that saved file
   * (never a stale in-memory buffer).
   */
  const runTransferToKeyboard = async (styleName: string) => {
    if (!midi.connected || !midi.profile) {
      toast.error("Connect a supported Yamaha keyboard and finish the style first.")
      return
    }
    stopPreview()
    const flushedMixers = flushDirtyPartMixers()
    const extension = styleExtensionFromFileName(donorFile?.name)
    const fileName = sanitizeStyleFileName(styleName, extension)

    let built: Uint8Array
    try {
      const fresh = buildCurrentStyleBytes()
      if (!fresh?.length) {
        toast.error("Assign clips or save a section mix first.")
        return
      }
      built = fresh
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build style")
      return
    }

    setModified(built)
    setTransferComplete("")
    setTransfer({
      phase: "initializing",
      percent: 1,
      message: "Saving style…",
    })

    try {
      await persistWorkspace({
        lastBuiltBytes: built,
        lastBuiltFileName: fileName,
        partMixers: flushedMixers,
      })
    } catch (error) {
      setTransfer(null)
      toast.error(
        error instanceof Error ? error.message : "Could not save style before transfer.",
      )
      return
    }

    // Prefer the bytes we just wrote to the local draft.
    const cached = await loadStyleMakerDraft({
      userId: accountUserIdRef.current,
      projectId: cloudProjectIdRef.current,
    })
    const savedBytes =
      cached?.lastBuiltBytes && cached.lastBuiltBytes.length
        ? Uint8Array.from(cached.lastBuiltBytes)
        : new Uint8Array(built)
    const savedName = cached?.lastBuiltFileName || fileName

    setTransfer({
      phase: "initializing",
      percent: 4,
      message: "Preparing your style",
    })
    const transferClient = new MusicsoftTransfer(session, setTransfer)
    try {
      const result = await transferClient.transferStyle(savedBytes, savedName)
      if (midi.profile.oneClickActivation) {
        setTransfer({
          phase: "activating",
          percent: 90,
          message:
            "Style transferred. One-click activation awaits hardware validation.",
        })
      }
      setTransfer({
        phase: "complete",
        percent: 100,
        message: "Style is on your keyboard",
      })
      const completeMessage = midi.profile.oneClickActivation
        ? `${result.displayPath} transferred. Select it from USER styles for this validation build.`
        : `${result.displayPath} transferred. Automatic activation is not claimed for ${midi.profile.displayName}.`
      setTransferComplete(completeMessage)
      setStatus(completeMessage)
    } catch (error) {
      setTransfer(null)
      setTransferComplete("")
      toast.error(error instanceof Error ? error.message : "Transfer failed.")
    }
  }

  const laneHint = (lane: StyleMakerLane) => {
    const a = assignments[lane]
    if (a) {
      return a.origin === "upload"
        ? `${a.title} (Cubase MIDI)`
        : a.title
    }
    if (donor) return `Drop MIDI or assign · ${acceptedHint(lane)}`
    return `Empty — drop .mid / assign · ${acceptedHint(lane)}`
  }

  const setGuitarCasmModeForLane = (
    lane: StyleMakerLane,
    mode: StyleMakerGuitarCasmMode,
  ) => {
    const assignment =
      selectedVariant === "minor"
        ? minorAssignments[lane]
        : assignments[lane]
    if (
      assignment &&
      assignment.sourceKind === "guitar" &&
      isYamahaGuitarSourceMode(mode) &&
      !assignment.frozen
    ) {
      toast.error(
        `${displayName(lane)}: ${guitarCasmModeName(mode)} requires a frozen/imported Yamaha Guitar-source MIDI take. Normal rendered guitar MIDI must use Rendered MegaVoice performance.`,
      )
      return
    }
    setGuitarCasmModes((prev) => ({ ...prev, [lane]: mode }))
  }

  /** Only on the selected Chord/Pad/Phrase lane — not above the whole list. */
  const guitarCasmControlForLane = (lane: StyleMakerLane) => {
    if (selectedLane !== lane || !laneCanUseGuitar(lane)) return null
    const mode =
      guitarCasmModes[lane] ?? StyleMakerGuitarCasmMode.RenderedMegaVoice
    return (
      <div
        className="sm-guitar-casm-row"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <span>Guitar CASM</span>
        <select
          value={String(mode)}
          onChange={(event) => {
            setGuitarCasmModeForLane(
              lane,
              Number(event.target.value) as StyleMakerGuitarCasmMode,
            )
          }}
          title="Applies only to this guitar-capable lane."
        >
          {GUITAR_CASM_MODE_OPTIONS.map((option) => (
            <option key={option} value={String(option)}>
              {guitarCasmModeName(option)}
            </option>
          ))}
        </select>
      </div>
    )
  }

  const finishPartTypePrompt = (use: boolean) => {
    if (!partTypePrompt) return
    if (!use) {
      partTypePrompt.resolve(null)
      setPartTypePrompt(null)
      return
    }
    const choice = applyPartTypeChoice(
      partTypePrompt.lane,
      partTypePrompt.selectedIndex + 1,
      partTypePrompt.sourceKind,
    )
    partTypePrompt.resolve(choice)
    setPartTypePrompt(null)
  }

  return (
    <div className="sm-desktop">
      <header className="sm-topbar">
        <div className="sm-topbar-brand">
          SmartBridge
          <span>Style Maker · web desktop</span>
        </div>
        <div className="sm-topbar-right">
          <select
            id="sm-keyboard-model"
            className="sm-model-select"
            aria-label="Keyboard model"
            value={midi.profile?.id || ""}
            title="Voice and style catalogs for this keyboard"
            onChange={(event) => {
              const id = event.target.value as YamahaModelId
              if (!id || !KEYBOARD_PROFILES[id]) return
              session.setKeyboardModel(id)
            }}
          >
            <option value="" disabled>
              Keyboard model…
            </option>
            {ALL_YAMAHA_MODEL_IDS.map((id) => (
              <option key={id} value={id}>
                {KEYBOARD_PROFILES[id].displayName}
              </option>
            ))}
          </select>
          <StatusChip on={midi.connected}>
            {midi.connected
              ? midi.profile?.displayName || "MIDI connected"
              : "MIDI offline"}
          </StatusChip>
          <button
            type="button"
            className="sm-btn"
            onClick={() =>
              void session.requestAccess(
                midi.profile?.id || ("genos2" as YamahaModelId),
              )
            }
          >
            {midi.connected ? "Reconnect" : "Connect keyboard"}
          </button>
        </div>
      </header>

      <div className="sm-mode-tabs">
        <AppTabNav
          aria-label="Style Maker modes"
          activeId={modeTab}
          onChange={(id) => {
            const next = id as "build" | "mixer" | "export"
            setModeTab(next)
            if (next === "mixer" && sectionMixerKey) {
              setWorkingPartMixers((prev) => {
                const { working, mixer } = selectSectionMixer(
                  prev,
                  savedPartMixers,
                  sectionMixerKey,
                )
                applyCurrentSectionMixerToHardware(
                  mixer,
                  templatePartSnapshots,
                )
                return working
              })
            }
          }}
          tabs={[
            { id: "build", label: "Build", icon: Hammer },
            { id: "mixer", label: "Mixer", icon: SlidersHorizontal },
            { id: "export", label: "Export", icon: Package },
          ]}
        />
      </div>

      {pianoRollTarget && (
        <PianoRollModal
          target={pianoRollTarget}
          preview={preview.current}
          session={session}
          midiConnected={midi.connected}
          onAuditionTempo={pushAuditionTempo}
          onApply={applyPianoRoll}
        />
      )}

      {pendingTemplateImport && (
        <div className="sm-modal-backdrop" role="presentation">
          <div
            className="sm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sm-clear-project-title"
          >
            <h3 id="sm-clear-project-title">Clear current project?</h3>
            <p>
              Loading “{pendingTemplateImport.file.name}” will clear every
              section take, part mixer edit, and saved build, then start fresh
              with the new style template. Cloud projects stay in your account
              until you delete them.
            </p>
            <div className="sm-modal-actions">
              <button
                type="button"
                className="sm-btn"
                onClick={() => finishTemplateImportPrompt(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sm-btn is-primary"
                onClick={() => finishTemplateImportPrompt(true)}
              >
                Clear and load
              </button>
            </div>
          </div>
        </div>
      )}

      {saveAsPrompt && (
        <div className="sm-modal-backdrop" role="presentation">
          <div
            className="sm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sm-save-as-title"
          >
            <h3 id="sm-save-as-title">
              {saveAsPrompt.mode === "migrate"
                ? "Save browser project to your account?"
                : "Save project as"}
            </h3>
            <p>
              {saveAsPrompt.mode === "migrate"
                ? "This browser still has a Style Maker project. Save it to your account so it follows you across devices."
                : "Name this Style Maker project in your account."}
            </p>
            <label>
              Project name
              <input
                type="text"
                autoFocus
                value={saveAsPrompt.name}
                onChange={(event) =>
                  setSaveAsPrompt((prev) =>
                    prev ? { ...prev, name: event.target.value } : prev,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void finishSaveAsPrompt(true)
                  }
                }}
              />
            </label>
            <div className="sm-modal-actions">
              <button
                type="button"
                className="sm-btn"
                disabled={projectBusy}
                onClick={() => void finishSaveAsPrompt(false)}
              >
                {saveAsPrompt.mode === "migrate" ? "Not now" : "Cancel"}
              </button>
              <button
                type="button"
                className="sm-btn is-primary"
                disabled={projectBusy || !saveAsPrompt.name.trim()}
                onClick={() => void finishSaveAsPrompt(true)}
              >
                {projectBusy ? "Saving…" : "Save to account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openProjectModal && (
        <div className="sm-modal-backdrop" role="presentation">
          <div
            className="sm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sm-open-project-title"
          >
            <h3 id="sm-open-project-title">Open project</h3>
            <p>Projects saved to your SmartBridge account.</p>
            {projectList.length === 0 ? (
              <p>No saved projects yet. Use Save to create one.</p>
            ) : (
              <ul className="sm-project-list">
                {projectList.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="sm-btn"
                      disabled={projectBusy}
                      onClick={() => requestOpenProject(item.id)}
                    >
                      <strong>{item.name}</strong>
                      <span>
                        {item.donorFileName} ·{" "}
                        {new Date(item.updatedAt).toLocaleString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="sm-modal-actions">
              <button
                type="button"
                className="sm-btn"
                onClick={() => setOpenProjectModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingOpenProjectId && (
        <div className="sm-modal-backdrop" role="presentation">
          <div
            className="sm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sm-open-dirty-title"
          >
            <h3 id="sm-open-dirty-title">Discard unsaved changes?</h3>
            <p>
              Opening another project will replace the current editor. Unsaved
              edits that were not saved to your account will be lost from this
              view (local draft may still exist).
            </p>
            <div className="sm-modal-actions">
              <button
                type="button"
                className="sm-btn"
                onClick={() => confirmOpenProject(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sm-btn is-primary"
                onClick={() => confirmOpenProject(true)}
              >
                Open project
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteProjectPrompt && (
        <div className="sm-modal-backdrop" role="presentation">
          <div
            className="sm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sm-delete-project-title"
          >
            <h3 id="sm-delete-project-title">Delete project?</h3>
            <p>
              Permanently delete “{cloudProjectName || "this project"}” from
              your account. This cannot be undone.
            </p>
            <div className="sm-modal-actions">
              <button
                type="button"
                className="sm-btn"
                onClick={() => void finishDeleteProject(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sm-btn is-primary"
                disabled={projectBusy}
                onClick={() => void finishDeleteProject(true)}
              >
                {projectBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {partTypePrompt && (
        <div className="sm-modal-backdrop" role="presentation">
          <div
            className="sm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sm-part-type-title"
          >
            <h3 id="sm-part-type-title">Part Type</h3>
            <p>Tell SmartBridge what this lane should be in the Yamaha style.</p>
            <label>
              {displayName(partTypePrompt.lane)}: {partTypePrompt.clipName}
              <select
                value={String(partTypePrompt.selectedIndex)}
                onChange={(event) =>
                  setPartTypePrompt((prev) =>
                    prev
                      ? {
                          ...prev,
                          selectedIndex: Number(event.target.value),
                        }
                      : prev,
                  )
                }
              >
                {partTypeChoicesForLane(partTypePrompt.lane).map((label, index) => (
                  <option key={label} value={String(index)}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm-modal-actions">
              <button type="button" className="sm-btn" onClick={() => finishPartTypePrompt(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="sm-btn is-primary"
                onClick={() => finishPartTypePrompt(true)}
              >
                Use This
              </button>
            </div>
          </div>
        </div>
      )}

      {transferNamePrompt && (
        <div className="sm-modal-backdrop" role="presentation">
          <div
            className="sm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sm-style-name-title"
          >
            <h3 id="sm-style-name-title">Style name</h3>
            <p>
              Name the style for USER:\STYLE on the keyboard. Defaults to the
              current template name.
            </p>
            <label>
              Style name
              <input
                type="text"
                autoFocus
                value={transferNamePrompt.name}
                onChange={(event) =>
                  setTransferNamePrompt({ name: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    const name = transferNamePrompt.name.trim()
                    if (!name) {
                      toast.error("Enter a style name.")
                      return
                    }
                    setTransferNamePrompt(null)
                    void runTransferToKeyboard(name)
                  }
                }}
              />
            </label>
            <div className="sm-modal-actions">
              <button
                type="button"
                className="sm-btn"
                onClick={() => setTransferNamePrompt(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sm-btn is-primary"
                onClick={() => {
                  const name = transferNamePrompt.name.trim()
                  if (!name) {
                    toast.error("Enter a style name.")
                    return
                  }
                  setTransferNamePrompt(null)
                  void runTransferToKeyboard(name)
                }}
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {transfer && (
        <div
          className="transfer-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Loading style to keyboard"
        >
          <div
            className={`transfer-card${
              transfer.phase === "complete" ? " is-complete" : ""
            }`}
          >
            <span className="transfer-icon">
              {transfer.phase === "complete" ? (
                <Check size={34} />
              ) : (
                <LoaderCircle size={34} />
              )}
            </span>
            <span className="demo-eyebrow">
              {transfer.phase === "complete"
                ? "Your new band is ready"
                : "Load to Keyboard"}
            </span>
            <h2>{transfer.message}</h2>
            <p>
              {transferComplete ||
                "Keep the browser open and do not disconnect the USB cable."}
            </p>
            <div className="transfer-progress">
              <i style={{ width: `${transfer.percent}%` }} />
            </div>
            <strong>{Math.round(transfer.percent)}%</strong>
            {transfer.phase === "complete" && (
              <button
                className="sm-btn is-primary"
                type="button"
                onClick={() => {
                  setTransfer(null)
                  setTransferComplete("")
                }}
              >
                Return to Style Maker
              </button>
            )}
          </div>
        </div>
      )}

      {modeTab === "mixer" ? (
        donor ? (
          <StylePartMixerPanel
            sectionNames={
              styleSections.length
                ? styleSections.map((section) => section.label.trim())
                : [sectionName]
            }
            sectionName={sectionMixerKey || sectionName}
            onSectionChange={onMixerSectionChange}
            workingMixer={workingMixerForSection}
            templateSnapshots={templatePartSnapshots}
            dirty={mixerDirty}
            statusText={
              mixerDirty
                ? `Unsaved mixer changes for ${sectionMixerKey}`
                : `Mixer edits are saved for ${sectionMixerKey}`
            }
            modelKey={midi.profile?.id || null}
            onSaveSectionMix={() => saveSectionMix(sectionMixerKey)}
            onCopyVoicesToAllSections={onCopyVoicesToAllSections}
            onPartValueChange={onPartValueChange}
            onVoiceSelected={onMixerVoiceSelected}
          />
        ) : (
          <EmptyState
            icon={SlidersHorizontal}
            title="No style loaded"
            description="Import a style template in Build, then open Mixer to set voices, volume, pan, reverb, and chorus for channels 9–16."
            action={
              <button
                type="button"
                className="sm-btn is-primary"
                onClick={() => setModeTab("build")}
              >
                Go to Build
              </button>
            }
          />
        )
      ) : modeTab === "export" ? (
        <div className="sm-export">
          <div className="sm-export-card">
            <p className="ux-section-label">Export</p>
            <h2>Save or send your style</h2>
            <p>
              Save named projects to your account, download a native .sty/.prs,
              or transfer straight to USER:\STYLE on the keyboard.
            </p>
            <div className="sm-export-actions">
              <button
                type="button"
                className="sm-btn"
                onClick={() => void beginOpenProjects()}
                disabled={projectBusy}
              >
                Open…
              </button>
              <button
                type="button"
                className="sm-btn"
                onClick={() => void saveWorkspaceNow()}
                disabled={!donorFile || projectBusy}
              >
                Save
              </button>
              <button
                type="button"
                className="sm-btn"
                onClick={beginSaveAs}
                disabled={!donorFile || projectBusy}
              >
                Save As…
              </button>
              <button
                type="button"
                className="sm-btn"
                onClick={() => setDeleteProjectPrompt(true)}
                disabled={!cloudProjectId || projectBusy}
              >
                Delete…
              </button>
              <button
                type="button"
                className="sm-btn is-primary"
                onClick={exportFile}
                disabled={!donorFile}
              >
                Export style…
              </button>
              <button
                type="button"
                className="sm-btn"
                onClick={beginTransferToKeyboard}
                disabled={!donorFile || !midi.connected}
              >
                Transfer to keyboard…
              </button>
            </div>
            {!donorFile ? (
              <p>Import a template and assign clips in Build first.</p>
            ) : (
              <p>
                {cloudProjectName
                  ? `Account project: ${cloudProjectName}`
                  : "Unsaved project (not yet on your account)"}
                {" · "}
                Template: {donorFile.name}
                {modified ? " · ready to export" : " · assign a clip or save a mix"}
                {projectDirty ? " · local changes" : ""}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="sm-build">
          <div className="sm-setup">
            <CollapsibleCard
              title="Section setup"
              open={setupOpen}
              onOpenChange={setSetupOpen}
              summary={
                <>
                  {sectionName} · {bars} bars
                  {donorFile ? ` · ${donorFile.name}` : " · no template"}
                </>
              }
            >
              <div className="sm-toolbar">
                <label>
                  Section
                  <select
                    value={sectionName}
                    onChange={(event) => {
                      stopPreview()
                      setSectionName(event.target.value)
                      setStatus(`Editing ${event.target.value}`)
                    }}
                  >
                    {(styleSections.length
                      ? styleSections.map((section) => section.label.trim())
                      : SECTIONS
                    ).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Bars
                  <select
                    value={String(bars)}
                    onChange={(event) => setBars(Number(event.target.value))}
                  >
                    {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="sm-btn"
                  onClick={() => templateInput.current?.click()}
                >
                  Import style-template…
                </button>
                <input
                  ref={templateInput}
                  className="sm-hidden-input"
                  type="file"
                  accept=".sty,.prs,.sst,.fps"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) requestImportTemplate(file)
                    event.target.value = ""
                  }}
                />

                <label className="sm-check">
                  <input
                    type="checkbox"
                    checked={includeCC}
                    onChange={(event) => setIncludeCC(event.target.checked)}
                  />
                  Include CC / Controllers
                </label>

                <button
                  type="button"
                  className="sm-btn is-primary"
                  onClick={() => void assignSelectedClip()}
                >
                  Add selected clip to {displayName(selectedLane)}
                  {canPreviewMinor && selectedVariant === "minor"
                    ? " MIN"
                    : canPreviewMinor
                      ? " MAJ"
                      : ""}
                </button>
                <button type="button" className="sm-btn" onClick={clearAll}>
                  Clear all
                </button>
              </div>

              <div className="sm-setup-style-load">
                <p className="ux-section-label">Load style to keyboard</p>
                <StyleCatalogControls
                  profile={midi.profile}
                  disabled={!midi.connected || !midi.profile}
                  datalistId="style-maker-style-suggestions"
                  onSelectStyle={(mapping, entry) => {
                    if (!midi.connected || !midi.profile) {
                      toast.error(
                        "Connect a supported Yamaha keyboard to load a style.",
                      )
                      setStatus("Connect a keyboard to load a style")
                      return
                    }
                    try {
                      sendPresetStyleSelect(session, mapping, midi.profile.id)
                      setStatus(
                        `${entry.name} selected on your ${midi.profile.displayName}.`,
                      )
                    } catch (error) {
                      const message =
                        error instanceof Error
                          ? error.message
                          : "Could not send the style to the keyboard."
                      toast.error(message)
                      setStatus(message)
                    }
                  }}
                />
              </div>
            </CollapsibleCard>
          </div>

          <div className={`sm-body${canPreviewMinor ? " is-minor-lanes" : ""}`}>
            <aside className="sm-lanes" aria-label="Style lanes">
              <SectionLabel className="sm-lanes-heading">Lanes</SectionLabel>
              {!donor ? (
                <EmptyState
                  icon={Upload}
                  title="Import a template"
                  description="Load a Yamaha .sty/.prs to see lane slots and assign library clips."
                  action={
                    <button
                      type="button"
                      className="sm-btn is-primary"
                      onClick={() => templateInput.current?.click()}
                    >
                      Import style-template…
                    </button>
                  }
                />
              ) : null}
              {donor &&
              ALL_LANES.map((lane) => {
                const assignment = assignments[lane]
                const minorAssignment = minorAssignments[lane]
                const twin = Boolean(
                  selectedSection &&
                    laneSupportsMinorTake(
                      selectedSection.label,
                      lane,
                      donor?.yamahaTail,
                    ),
                )
                const hasTemplateMinor = Boolean(
                  selectedSection &&
                    laneHasTemplateMinorSource(
                      selectedSection.label,
                      lane,
                      donor?.yamahaTail,
                    ),
                )
                const majorTemplateNotes =
                  !assignment && donor && selectedSection
                    ? extractLaneTemplateNotes(
                        donor,
                        selectedSection,
                        lane,
                        false,
                      )
                    : []
                const minorTemplateNotes =
                  !minorAssignment && donor && selectedSection
                    ? extractLaneTemplateNotes(
                        donor,
                        selectedSection,
                        lane,
                        true,
                      )
                    : []
                const majorStatus = assignment
                  ? `${assignment.title}${
                      assignment.origin === "upload" ? " (Cubase MIDI)" : ""
                    }`
                  : majorTemplateNotes.length
                    ? `Original (template) · ${majorTemplateNotes.length} notes`
                    : donor
                      ? "Original (template)"
                      : "drop major take"
                const minorStatus = minorAssignment
                  ? `${minorAssignment.title}${
                      minorAssignment.origin === "upload" ? " (Cubase MIDI)" : ""
                    }`
                  : hasTemplateMinor && minorTemplateNotes.length
                    ? `Original (template) · ${minorTemplateNotes.length} notes`
                    : hasTemplateMinor
                      ? "Original (template)"
                      : "drop minor take"

                if (twin) {
                  return (
                    <div
                      key={lane}
                      className={`sm-lane is-twin${
                        selectedLane === lane ? " is-selected" : ""
                      }`}
                    >
                      <div className="sm-lane-name">
                        {displayName(lane)}
                        <span style={{ color: "var(--sm-muted)", fontWeight: 500 }}>
                          {" "}
                          (Channel {styleChannel(lane)})
                        </span>
                      </div>
                      {guitarCasmControlForLane(lane)}
                      <div className="sm-lane-twins">
                        {(
                          [
                            ["major", "MAJ", "major chord", majorStatus],
                            ["minor", "MIN", "minor chord", minorStatus],
                          ] as const
                        ).map(([variant, badge, chordLabel, status]) => {
                          const isDrop =
                            dropLane === lane && dropVariant === variant
                          const isSelected =
                            selectedLane === lane && selectedVariant === variant
                          const canPlay =
                            variant === "major"
                              ? Boolean(
                                  assignment || majorTemplateNotes.length > 0,
                                )
                              : Boolean(
                                  minorAssignment ||
                                    minorTemplateNotes.length > 0,
                                )
                          return (
                            <div
                              key={variant}
                              role="button"
                              tabIndex={0}
                              className={`sm-dropbox is-${
                                variant === "major" ? "maj" : "min"
                              }${isSelected ? " is-selected" : ""}${
                                isDrop
                                  ? dropKind === "midi"
                                    ? " is-file-drop-target"
                                    : " is-drop-target"
                                  : ""
                              }`}
                              onClick={() => {
                                setSelectedLane(lane)
                                setSelectedVariant(variant)
                              }}
                              onDoubleClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                openPianoRoll(lane, variant)
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault()
                                  setSelectedLane(lane)
                                  setSelectedVariant(variant)
                                }
                              }}
                              onDragEnter={(event) =>
                                onLaneDragOver(event, lane, variant)
                              }
                              onDragOver={(event) =>
                                onLaneDragOver(event, lane, variant)
                              }
                              onDragLeave={() => {
                                if (dropLane === lane && dropVariant === variant) {
                                  setDropLane(null)
                                  setDropKind(null)
                                  setDropVariant(null)
                                }
                              }}
                              onDrop={(event) => onLaneDrop(event, lane, variant)}
                            >
                              <span className="sm-dropbox-badge">{badge}</span>
                              <span className="sm-dropbox-chord">{chordLabel}</span>
                              <div className="sm-dropbox-status">
                                {isDrop
                                  ? dropKind === "midi"
                                    ? `Drop MIDI (${badge})`
                                    : `Drop clip (${badge})`
                                  : status}
                              </div>
                              <div className="sm-dropbox-actions">
                                {variant === "minor" && minorAssignment && (
                                  <button
                                    type="button"
                                    title="Clear minor take"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      clearLane(lane, "minor")
                                    }}
                                  >
                                    ×
                                  </button>
                                )}
                                <button
                                  type="button"
                                  title={`Play ${badge}`}
                                  disabled={!canPlay}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setSelectedLane(lane)
                                    setSelectedVariant(variant)
                                    playLane(lane, variant)
                                  }}
                                >
                                  ▶
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="sm-lane-clear-row">
                        <button
                          type="button"
                          className="sm-btn"
                          title="Clear major and minor takes"
                          onClick={() => clearLane(lane)}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={lane}
                    role="button"
                    tabIndex={0}
                    className={`sm-lane${selectedLane === lane ? " is-selected" : ""}${
                      dropLane === lane && dropVariant !== "minor"
                        ? dropKind === "midi"
                          ? " is-file-drop-target"
                          : " is-drop-target"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedLane(lane)
                      setSelectedVariant("major")
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      openPianoRoll(lane, "major")
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        setSelectedLane(lane)
                        setSelectedVariant("major")
                      }
                    }}
                    onDragEnter={(event) => onLaneDragOver(event, lane, "major")}
                    onDragOver={(event) => onLaneDragOver(event, lane, "major")}
                    onDragLeave={() => {
                      if (dropLane === lane) {
                        setDropLane(null)
                        setDropKind(null)
                        setDropVariant(null)
                      }
                    }}
                    onDrop={(event) => onLaneDrop(event, lane, "major")}
                  >
                    <div className="sm-lane-name">
                      {displayName(lane)}
                      <span style={{ color: "var(--sm-muted)", fontWeight: 500 }}>
                        {" "}
                        (Channel {styleChannel(lane)})
                      </span>
                    </div>
                    {guitarCasmControlForLane(lane)}
                    <div className="sm-lane-actions">
                      <button
                        type="button"
                        title="Play lane"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedLane(lane)
                          setSelectedVariant("major")
                          playLane(lane, "major")
                        }}
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        title="Stop"
                        onClick={(event) => {
                          event.stopPropagation()
                          stopPreview()
                        }}
                      >
                        ■
                      </button>
                      <button
                        type="button"
                        title="Clear"
                        onClick={(event) => {
                          event.stopPropagation()
                          clearLane(lane)
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="sm-lane-sub">
                      {dropLane === lane && dropVariant !== "minor"
                        ? dropKind === "midi"
                          ? `Drop MIDI on ${displayName(lane)}`
                          : "Drop clip here to assign"
                        : assignment
                          ? `${assignment.title}${
                              assignment.origin === "upload" ? " (Cubase MIDI)" : ""
                            }`
                          : laneHint(lane)}
                    </div>
                  </div>
                )
              })}
            </aside>

            <section className="sm-library" aria-label="Phrase library">
              <div className="sm-lib-tabs">
                {LIB_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={libTab === tab.id ? "is-active" : ""}
                    onClick={() => {
                      setLibTab(tab.id)
                      const mapped =
                        tab.id === "drums"
                          ? StyleMakerLane.Rhythm1
                          : tab.id === "bass"
                            ? StyleMakerLane.Bass
                            : tab.id === "guitar"
                              ? StyleMakerLane.Chord1
                              : selectedLane
                      if (tab.id !== "brass") setSelectedLane(mapped)
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="sm-lib-head">
                <div>
                  <p className="ux-section-label">Library</p>
                  <h2>
                    {libTab === "bass"
                      ? "Bass phrases"
                      : libTab === "drums"
                        ? "Drum phrases"
                        : libTab === "guitar"
                          ? "Guitar phrases"
                          : "Brass phrases"}
                  </h2>
                  <div className="sm-lib-meta">
                    <StatusChip on={Boolean(donor)}>
                      {donorFile ? donorFile.name : "No template"}
                    </StatusChip>
                    <span className="sm-lib-count">
                      {loadingClips
                        ? "Loading…"
                        : `${totalClips.toLocaleString()} clips`}
                    </span>
                    <span>{sectionName}</span>
                    <span>{bars} bars</span>
                    <span>
                      {styleBpm} bpm{donor ? " (style)" : ""}
                    </span>
                  </div>
                </div>
              </div>

              <div className="sm-lib-filters-wrap">
                <CollapsibleCard
                  title="Filters"
                  open={libFiltersOpen}
                  onOpenChange={setLibFiltersOpen}
                  summary={
                    <>
                      {genre === "all" ? "All genres" : genre}
                      {" · "}
                      {sectionFilter || "All types"}
                      {" · "}
                      {feelMode || "All feels"}
                      {search ? ` · “${search}”` : ""}
                    </>
                  }
                >
                  <div className="sm-lib-filters">
                    <label>
                      Genre
                      <select
                        value={genre}
                        onChange={(e) => {
                          setGenre(e.target.value)
                          if (libTab === "drums") setSectionFilter("")
                        }}
                        title="Genre"
                      >
                        <option value="all">All Genres</option>
                        {categories.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {libTab === "bass" ? (
                      <label>
                        Section
                        <select
                          value={sectionFilter}
                          onChange={(e) => setSectionFilter(e.target.value)}
                          title="Section"
                        >
                          {BASS_SECTION_OPTIONS.map((opt) => (
                            <option key={opt.label} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : libTab === "drums" ? (
                      <label>
                        Section type
                        <select
                          value={sectionFilter}
                          onChange={(e) => setSectionFilter(e.target.value)}
                          title="Section type"
                        >
                          {DRUM_SECTION_OPTIONS.map((opt) => (
                            <option key={opt.label} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label>
                        Section
                        <select
                          value={sectionFilter}
                          onChange={(e) => setSectionFilter(e.target.value)}
                          title="Section"
                        >
                          <option value="">All Types</option>
                          {facetSections.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label>
                      Feel
                      <select
                        value={feelMode}
                        onChange={(e) =>
                          setFeelMode(e.target.value as FeelModeFilter)
                        }
                        title="Feel"
                      >
                        {FEEL_MODE_OPTIONS.map((opt) => (
                          <option key={opt.label} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {libTab === "bass" && (
                      <label>
                        Tempo
                        <select
                          value={String(tempoBand)}
                          onChange={(e) =>
                            setTempoBand(Number(e.target.value) as TempoBandId)
                          }
                          title="Tempo band"
                        >
                          {TEMPO_BAND_OPTIONS.map((opt) => (
                            <option key={opt.id} value={String(opt.id)}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label className="sm-lib-search">
                      Search
                      <input
                        type="text"
                        placeholder="Quick search…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  </div>
                </CollapsibleCard>
              </div>

              <div className="sm-lib-workspace">
                <div className="sm-clip-panel">
                  <div className="sm-clip-head" aria-hidden="true">
                    <span>Name</span>
                    <span>Genre</span>
                    <span>Section</span>
                    <span>Feel</span>
                    <span>BPM</span>
                    <span>Bars</span>
                    <span>Notes</span>
                    <span>Q</span>
                  </div>
                  <div className="sm-clip-list" role="listbox" aria-label="Library clips">
                    {clips.map((clip) => {
                      const level = meterLevel(clip.noteCount)
                      return (
                        <div
                          key={clip.id}
                          role="option"
                          tabIndex={0}
                          draggable
                          aria-selected={selectedClipId === clip.id}
                          className={`sm-clip${selectedClipId === clip.id ? " is-selected" : ""}`}
                          onClick={() => setSelectedClipId(clip.id)}
                          onDoubleClick={() => void auditionClip(clip)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              setSelectedClipId(clip.id)
                            }
                          }}
                          onDragStart={(event) => {
                            setSelectedClipId(clip.id)
                            event.dataTransfer.setData(
                              CLIP_DND_TYPE,
                              JSON.stringify(clip),
                            )
                            event.dataTransfer.setData(
                              "text/plain",
                              formatClipTitle(clip.clipName, clip.id),
                            )
                            event.dataTransfer.effectAllowed = "copy"
                            document.body.classList.add("sm-dragging-clip")
                          }}
                          onDragEnd={() => {
                            setDropLane(null)
                            document.body.classList.remove("sm-dragging-clip")
                          }}
                        >
                          <span className="sm-clip-name" title={clip.clipName || undefined}>
                            {formatClipTitle(clip.clipName, clip.id)}
                          </span>
                          <span>{clip.categoryName || "—"}</span>
                          <span>{clip.sectionType || "—"}</span>
                          <span>{clip.feelMode || clip.feelName || "—"}</span>
                          <span className="sm-clip-num">
                            {clip.bpm ? Math.round(clip.bpm) : "—"}
                          </span>
                          <span className="sm-clip-num">
                            {clip.bars != null ? clip.bars : "—"}
                          </span>
                          <span className="sm-clip-num">{clip.noteCount}</span>
                          <span className="sm-meter" aria-hidden="true">
                            {Array.from({ length: 5 }, (_, i) => (
                              <i key={i} className={i < level ? "is-on" : ""} />
                            ))}
                          </span>
                        </div>
                      )
                    })}
                    {!loadingClips && clips.length === 0 && (
                      <EmptyState
                        icon={Music2}
                        title="No clips match these filters"
                        description="Widen genre / feel, or clear search — then select a row and Play."
                      />
                    )}
                  </div>
                </div>

                <div className="sm-lib-stage" aria-label="Audition stage">
                  <div className="sm-lib-stage-head">
                    <div>
                      <p className="ux-section-label">Audition</p>
                      <strong>
                        {selectedClip
                          ? formatClipTitle(selectedClip.clipName, selectedClip.id)
                          : "Select a clip"}
                      </strong>
                    </div>
                    <div className="sm-transport">
                      <button
                        type="button"
                        className="sm-btn is-play"
                        onClick={() => void playSelectedClip()}
                        disabled={!selectedClip || !midi.connected}
                        title={
                          !midi.connected
                            ? "Connect the keyboard to audition clips"
                            : "Audition selected clip"
                        }
                      >
                        Play
                      </button>
                      <button
                        type="button"
                        className="sm-btn is-stop"
                        onClick={stopPreview}
                        title="Stop audition"
                      >
                        Stop
                      </button>
                    </div>
                  </div>

                  <div className="sm-lib-stage-grid">
                    {libTab === "bass" && (
                      <>
                        <label>
                          Time
                          <select
                            value={String(bassTimeFeel)}
                            onChange={(e) =>
                              setBassTimeFeel(Number(e.target.value) as TimeFeelId)
                            }
                          >
                            {TIME_FEEL_OPTIONS.map((opt) => (
                              <option key={opt.id} value={String(opt.id)}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Vel
                          <select
                            value={String(bassVel)}
                            onChange={(e) => setBassVel(Number(e.target.value))}
                          >
                            {VELOCITY_DELTA_OPTIONS.map((d) => (
                              <option key={d} value={String(d)}>
                                {d > 0 ? `+${d}` : String(d)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Dead
                          <select
                            value={String(bassDead)}
                            onChange={(e) => setBassDead(Number(e.target.value))}
                          >
                            {VELOCITY_DELTA_OPTIONS.map((d) => (
                              <option key={d} value={String(d)}>
                                {d > 0 ? `+${d}` : String(d)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}

                    {libTab === "drums" && (
                      <label>
                        Map
                        <select
                          value={
                            isGenosFamilyProfileId(midi.profile?.id)
                              ? drumMapping
                              : "gm"
                          }
                          onChange={(e) =>
                            setDrumMapping(e.target.value as DrumMappingMode)
                          }
                          disabled={!isGenosFamilyProfileId(midi.profile?.id)}
                          title={
                            isGenosFamilyProfileId(midi.profile?.id)
                              ? "Ambient remaps GM hats 42/44/46 → 15/18/17 (+20 vel on 13–22)"
                              : "Ambient/Revo hats are Genos-only — locked to GM"
                          }
                        >
                          <option value="ambient">Ambient</option>
                          <option value="gm">GM</option>
                        </select>
                      </label>
                    )}

                    <label>
                      Channel
                      {libTab === "drums" ? (
                        <select
                          value={String(drumChannelSelection)}
                          onChange={(event) => {
                            const value = Number(event.target.value)
                            setDrumChannelSelection(value)
                            if (value !== DRUM_AUTO_CHANNEL) {
                              setAuditionChannel("drums", value)
                            }
                          }}
                        >
                          <option value={String(DRUM_AUTO_CHANNEL)}>Auto</option>
                          {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                            <option key={ch} value={String(ch)}>
                              {ch}
                              {ch === DEFAULT_AUDITION_CHANNELS.drums
                                ? " (default)"
                                : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={String(activeAuditionChannel)}
                          onChange={(event) =>
                            setAuditionChannel(
                              activeAuditionInstrument,
                              Number(event.target.value),
                            )
                          }
                        >
                          {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                            <option key={ch} value={String(ch)}>
                              {ch}
                              {ch ===
                              DEFAULT_AUDITION_CHANNELS[activeAuditionInstrument]
                                ? " (default)"
                                : ""}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>

                    {libTab === "bass" && (
                      <label>
                        Voice search
                        <input
                          type="text"
                          placeholder="Voice…"
                          value={voiceSearch}
                          onChange={(e) => setVoiceSearch(e.target.value)}
                        />
                      </label>
                    )}

                    <label className="sm-lib-stage-voice">
                      Voice
                      <select
                        value={voiceSelection[activeAuditionInstrument]}
                        onChange={(event) =>
                          setInstrumentVoice(
                            activeAuditionInstrument,
                            event.target.value,
                          )
                        }
                        title={
                          activeAuditionInstrument === "bass"
                            ? "MegaVoice bass"
                            : activeAuditionInstrument === "guitar"
                              ? "MegaVoice acoustic / electric guitar"
                              : activeAuditionInstrument === "drums"
                                ? "Drum kits"
                                : "Brass voice"
                        }
                      >
                        {activeAuditionInstrument === "guitar" ? (
                          <>
                            <optgroup label="Acoustic MegaVoice">
                              {activeVoiceChoices
                                .filter((voice) => voice.group === "Acoustic")
                                .map((voice) => (
                                  <option key={voice.id} value={voice.id}>
                                    {voice.id}
                                  </option>
                                ))}
                            </optgroup>
                            <optgroup label="Electric MegaVoice">
                              {activeVoiceChoices
                                .filter((voice) => voice.group === "Electric")
                                .map((voice) => (
                                  <option key={voice.id} value={voice.id}>
                                    {voice.id}
                                  </option>
                                ))}
                            </optgroup>
                          </>
                        ) : activeAuditionInstrument === "drums" ? (
                          <>
                            <optgroup label="DrumKit">
                              {activeVoiceChoices
                                .filter((voice) => voice.group === "DrumKit")
                                .map((voice) => (
                                  <option key={voice.id} value={voice.id}>
                                    {voice.label}
                                  </option>
                                ))}
                            </optgroup>
                            <optgroup label="Legacy">
                              {activeVoiceChoices
                                .filter((voice) => voice.group === "Legacy")
                                .map((voice) => (
                                  <option key={voice.id} value={voice.id}>
                                    {voice.label}
                                  </option>
                                ))}
                            </optgroup>
                          </>
                        ) : (
                          activeVoiceChoices.map((voice) => (
                            <option key={voice.id} value={voice.id}>
                              {voice.label}
                            </option>
                          ))
                        )}
                      </select>
                    </label>

                    <div className="sm-lib-stage-target">
                      <span className="ux-section-label">Target</span>
                      <strong>{displayName(selectedLane)}</strong>
                    </div>
                  </div>

                  <div className="sm-status-box">
                    {selectedClip
                      ? `${selectedClip.sectionType || "—"} · ${
                          selectedClip.feelMode || selectedClip.feelName || "—"
                        } · ${
                          selectedClip.bpm ? `${Math.round(selectedClip.bpm)} BPM` : "—"
                        }${
                          selectedClip.bars != null ? ` · ${selectedClip.bars} bars` : ""
                        } · ch ${
                          libTab === "drums"
                            ? drumChannelSelection === DRUM_AUTO_CHANNEL
                              ? `Auto→${resolveDrumAuditionChannel(DRUM_AUTO_CHANNEL, selectedClip.categoryName)}`
                              : String(drumChannelSelection)
                            : String(activeAuditionChannel)
                        } · ${activeVoice.label}`
                      : "Select a clip, then Play or double-click to audition. Drag onto a lane to assign."}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <footer className="sm-bottom">
            <button type="button" className="sm-btn" onClick={() => playSection(false)}>
              Preview Major
            </button>
            <button
              type="button"
              className="sm-btn"
              onClick={() => playSection(true)}
              disabled={!canPreviewMinor}
              title={
                canPreviewMinor
                  ? "Audition minor CASM sources over Am"
                  : "Preview Minor applies to Intro / Ending sections"
              }
            >
              Preview Minor
            </button>
            <button
              type="button"
              className="sm-btn"
              onClick={() => void beginOpenProjects()}
              disabled={projectBusy}
              title="Open a project saved to your account"
            >
              Open…
            </button>
            <button
              type="button"
              className="sm-btn"
              onClick={() => void saveWorkspaceNow()}
              disabled={!donorFile || projectBusy}
              title={
                cloudProjectName
                  ? `Save “${cloudProjectName}” to your account`
                  : "Save this project to your account"
              }
            >
              Save
            </button>
            <button
              type="button"
              className="sm-btn"
              onClick={beginSaveAs}
              disabled={!donorFile || projectBusy}
              title="Save a new named project to your account"
            >
              Save As…
            </button>
            <button type="button" className="sm-btn" onClick={exportFile} disabled={!modified}>
              Export style…
            </button>
            <button
              type="button"
              className="sm-btn is-primary"
              onClick={beginTransferToKeyboard}
              disabled={!modified || !!transfer}
              title={
                !midi.connected
                  ? "Connect the keyboard first"
                  : "Transfer into USER:\\STYLE"
              }
            >
              Transfer to keyboard…
            </button>
            <button type="button" className="sm-btn is-stop" onClick={stopPreview}>
              Stop
            </button>
            <div className="sm-status" role="status">
              {transfer
                ? `${transfer.message} (${Math.round(transfer.percent)}%)`
                : status}
            </div>
          </footer>
        </div>
      )}
    </div>
  )
}
