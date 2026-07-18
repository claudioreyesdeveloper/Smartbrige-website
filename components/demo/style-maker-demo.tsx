"use client"

import {
  ArrowRight,
  Check,
  Circle,
  Download,
  FileMusic,
  GripVertical,
  LoaderCircle,
  Play,
  Save,
  Square,
  Upload,
  WandSparkles,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react"
import partCatalog from "@/data/demo/style-parts.json"
import { DemoShell } from "@/components/demo/demo-shell"
import { FeedbackPrompt } from "@/components/demo/feedback-prompt"
import {
  extractMidiNotes,
  extractStyleSectionPreviewEvents,
  extractStyleSections,
  parseYamahaStyle,
  patternToMidiNotes,
  replaceStyleLanes,
  replaceStyleSectionLanes,
  type MidiNote,
  type ParsedYamahaStyle,
  type StyleSectionRange,
} from "@/lib/demo/style-midi"
import {
  mainLabelToVariation,
  SectionRecorder,
  STYLE_CHANNEL_NAMES,
  type SectionRecordTake,
} from "@/lib/demo/section-record"
import { StylePreviewPlayer } from "@/lib/demo/style-preview"
import { styleSelectCommand } from "@/lib/demo/yamaha/commands"
import { MusicsoftTransfer } from "@/lib/demo/yamaha/musicsoft-transfer"
import {
  styleMappingForEntry,
  stylesForProfile,
} from "@/lib/demo/yamaha/style-catalog"
import { useMidiSession } from "@/lib/demo/yamaha/use-midi-session"
import type { StyleCatalogEntry, TransferProgress } from "@/lib/demo/types"

type Part = {
  id: string
  name: string
  genre: string
  bars: number
  notes: number[][]
}
type LaneSource = {
  id: string
  name: string
  notes: MidiNote[]
  cycleTicks: number
  custom?: boolean
}
type SectionRecipe = {
  bassId: string
  drumsId: string
  bassName: string
  drumsName: string
}

function laneSourceFor(
  id: string,
  parts: Part[],
  custom: LaneSource | null,
  donor: ParsedYamahaStyle | null,
  playedVelocityMax?: number,
): LaneSource | null {
  if (!donor) return null
  if (id === "custom") return custom
  const part = parts.find((candidate) => candidate.id === id)
  const notes = part ? patternToMidiNotes(part.notes, donor.ticksPerQuarter) : []
  return part
    ? {
        id: part.id,
        name: part.name,
        notes: playedVelocityMax
          ? notes.map((note) => ({
              ...note,
              velocity: Math.max(
                1,
                Math.min(
                  playedVelocityMax,
                  Math.round(30 + (note.velocity / 127) * (playedVelocityMax - 30)),
                ),
              ),
            }))
          : notes,
        cycleTicks: part.bars * 4 * donor.ticksPerQuarter,
      }
    : null
}

const bassParts = partCatalog.bass as Part[]
const drumParts = partCatalog.drums as Part[]
const bassPlayedVelocityMax = partCatalog.bassPlayedVelocityMax
const isMainSection = (section: StyleSectionRange) =>
  /^Main\s+[A-D]$/i.test(section.label.trim())

function RhythmGlyph({ part, active }: { part: Part; active: boolean }) {
  return (
    <span className={`rhythm-glyph${active ? " is-active" : ""}`} aria-hidden="true">
      {Array.from({ length: 16 }, (_, index) => {
        const hit = part.notes.some((note) => Math.round(note[0] * 4) === index)
        return <i key={index} className={hit ? "has-hit" : ""} />
      })}
    </span>
  )
}

export function StyleMakerDemo() {
  const [session, midi] = useMidiSession()
  const [donorFile, setDonorFile] = useState<File | null>(null)
  const [donor, setDonor] = useState<ParsedYamahaStyle | null>(null)
  const [workingStyle, setWorkingStyle] = useState<ParsedYamahaStyle | null>(null)
  const [bassId, setBassId] = useState(bassParts[0].id)
  const [drumsId, setDrumsId] = useState(drumParts[0].id)
  const [sectionId, setSectionId] = useState("")
  const [customBass, setCustomBass] = useState<LaneSource | null>(null)
  const [customDrums, setCustomDrums] = useState<LaneSource | null>(null)
  const [savedRecipes, setSavedRecipes] = useState<Record<string, SectionRecipe>>({})
  const [draftRecipes, setDraftRecipes] = useState<Record<string, SectionRecipe>>({})
  const [draftBytes, setDraftBytes] = useState<Uint8Array | null>(null)
  const [notice, setNotice] = useState("")
  const [dropActive, setDropActive] = useState(false)
  const [previewing, setPreviewing] = useState<
    "original" | "modified" | "bass" | "drums" | null
  >(null)
  const [transfer, setTransfer] = useState<TransferProgress | null>(null)
  const [transferComplete, setTransferComplete] = useState("")
  const [engagements, setEngagements] = useState(0)
  const [channelsEnabled, setChannelsEnabled] = useState(() =>
    STYLE_CHANNEL_NAMES.map(() => true),
  )
  const [recordPhase, setRecordPhase] = useState<"idle" | "recording" | "drag">("idle")
  const [recordTake, setRecordTake] = useState<SectionRecordTake | null>(null)
  const [recordStatus, setRecordStatus] = useState("")
  const [styleCategory, setStyleCategory] = useState("All")
  const [styleSearch, setStyleSearch] = useState("")
  const [styleKey, setStyleKey] = useState("")
  const preview = useRef<StylePreviewPlayer | null>(null)
  const donorInput = useRef<HTMLInputElement | null>(null)
  const recorder = useRef<SectionRecorder | null>(null)
  const dragMidiUrl = useRef<string | null>(null)
  const workingStyleRef = useRef<ParsedYamahaStyle | null>(null)
  workingStyleRef.current = workingStyle

  useEffect(() => {
    preview.current = new StylePreviewPlayer(session, () => setPreviewing(null))
    recorder.current = new SectionRecorder(session)
    return () => {
      preview.current?.stop()
      recorder.current?.cancel()
      if (dragMidiUrl.current) URL.revokeObjectURL(dragMidiUrl.current)
    }
  }, [session])

  const bass = useMemo<LaneSource | null>(() => {
    return laneSourceFor(bassId, bassParts, customBass, donor, bassPlayedVelocityMax)
  }, [bassId, customBass, donor])

  const drums = useMemo<LaneSource | null>(() => {
    return laneSourceFor(drumsId, drumParts, customDrums, donor)
  }, [customDrums, donor, drumsId])

  const styleSections = useMemo(
    () => donor ? extractStyleSections(donor).filter(isMainSection) : [],
    [donor],
  )
  const selectedSection = useMemo<StyleSectionRange | null>(
    () => styleSections.find((section) => section.id === sectionId) || styleSections[0] || null,
    [sectionId, styleSections],
  )
  const savedRecipe = selectedSection ? savedRecipes[selectedSection.id] : undefined
  const sectionDirty = Boolean(
    selectedSection &&
      bass &&
      drums &&
      (!savedRecipe ||
        savedRecipe.bassId !== bass.id ||
        savedRecipe.drumsId !== drums.id),
  )
  const savedSectionLabels = styleSections
    .filter((section) => savedRecipes[section.id])
    .map((section) => section.label)
  const exportBytes = workingStyle?.originalBytes || null
  const hasSavedSections = savedSectionLabels.length > 0

  // Same factory-style catalog path as Jam Player demo (stylesForProfile + styleSelectCommand).
  const availableStyles = useMemo(
    () => (midi.profile ? stylesForProfile(midi.profile) : []),
    [midi.profile],
  )
  const styleCategories = useMemo(
    () => ["All", ...Array.from(new Set(availableStyles.map((style) => style.category))).sort()],
    [availableStyles],
  )
  const filteredStyles = useMemo(() => {
    const search = styleSearch.trim().toLowerCase()
    return availableStyles.filter(
      (style) =>
        (styleCategory === "All" || style.category === styleCategory) &&
        (!search || style.name.toLowerCase().includes(search)),
    )
  }, [availableStyles, styleCategory, styleSearch])
  const entryKey = (style: StyleCatalogEntry) => `${style.styleNumber}:${style.name}`
  const selectedStyle =
    availableStyles.find((style) => entryKey(style) === styleKey) ||
    availableStyles.find((style) => style.name === "EasyPop") ||
    availableStyles[0]
  const selectedStyleVisible =
    selectedStyle && filteredStyles.some((style) => entryKey(style) === entryKey(selectedStyle))

  useEffect(() => {
    const first = availableStyles.find((style) => style.name === "EasyPop") || availableStyles[0]
    setStyleKey(first ? entryKey(first) : "")
    setStyleCategory("All")
    setStyleSearch("")
  }, [availableStyles])

  useEffect(() => {
    if (!workingStyle || !bass || !drums || !selectedSection) {
      setDraftBytes(null)
      return
    }
    try {
      setDraftBytes(replaceStyleLanes(workingStyle, {
        bass,
        drums,
        range: selectedSection,
      }))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not render the modified style.")
    }
  }, [bass, drums, selectedSection, workingStyle])

  const currentRecipe = (): SectionRecipe | null => {
    if (!bass || !drums) return null
    return {
      bassId: bass.id,
      drumsId: drums.id,
      bassName: bass.name,
      drumsName: drums.name,
    }
  }

  const uploadDonor = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const parsed = parseYamahaStyle(bytes)
      if (!parsed.yamahaTail.length) {
        throw new Error("Upload a native Yamaha .sty/.prs file with its CASM tail intact.")
      }
      const mainSections = extractStyleSections(parsed).filter(isMainSection)
      if (!mainSections.length) {
        throw new Error("This style does not contain a Main A, B, C, or D section.")
      }
      setDonorFile(file)
      setDonor(parsed)
      setWorkingStyle(parsed)
      setSavedRecipes({})
      setDraftRecipes({})
      setBassId(bassParts[0].id)
      setDrumsId(drumParts[0].id)
      setSectionId(mainSections[0].id)
      setRecordPhase("idle")
      setRecordTake(null)
      setRecordStatus("")
      setNotice("")
      setEngagements((value) => value + 1)
    } catch (error) {
      setDonorFile(null)
      setDonor(null)
      setWorkingStyle(null)
      setSavedRecipes({})
      setDraftRecipes({})
      setNotice(error instanceof Error ? error.message : "The style file could not be read.")
    }
  }

  const uploadLane = async (file: File, lane: "bass" | "drums") => {
    try {
      if (!donor) throw new Error("Upload the Yamaha donor style first.")
      const extracted = extractMidiNotes(new Uint8Array(await file.arrayBuffer()))
      const ratio = donor.ticksPerQuarter / extracted.ticksPerQuarter
      const source: LaneSource = {
        id: "custom",
        name: file.name,
        custom: true,
        notes: extracted.notes.map((note) => ({
          ...note,
          tick: Math.round(note.tick * ratio),
          duration: Math.max(1, Math.round(note.duration * ratio)),
        })),
        cycleTicks: Math.round(extracted.cycleTicks * ratio),
      }
      if (lane === "bass") {
        setCustomBass(source)
        setBassId("custom")
      } else {
        setCustomDrums(source)
        setDrumsId("custom")
      }
      setEngagements((value) => value + 1)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The MIDI part could not be read.")
    }
  }

  const playVersion = (version: "original" | "modified") => {
    if (!midi.connected) {
      setNotice("Connect the Yamaha keyboard to audition through its sounds.")
      return
    }
    if (!donor || !selectedSection || (version === "modified" && !draftBytes)) return
    const parsed = version === "original" ? donor : parseYamahaStyle(draftBytes!)
    preview.current?.play(
      extractStyleSectionPreviewEvents(parsed, selectedSection),
      parsed.ticksPerQuarter,
      120,
    )
    setPreviewing(version)
    setEngagements((value) => value + 1)
  }

  const playLane = (lane: "bass" | "drums", requestedId?: string) => {
    if (!midi.connected || !workingStyle || !selectedSection) {
      setNotice("Connect the Yamaha keyboard and choose a donor style first.")
      return
    }
    const auditionBass = laneSourceFor(
      lane === "bass" && requestedId ? requestedId : bassId,
      bassParts,
      customBass,
      donor,
      bassPlayedVelocityMax,
    )
    const auditionDrums = laneSourceFor(
      lane === "drums" && requestedId ? requestedId : drumsId,
      drumParts,
      customDrums,
      donor,
    )
    if (!auditionBass || !auditionDrums) return
    const rendered = replaceStyleLanes(workingStyle, {
      bass: auditionBass,
      drums: auditionDrums,
      range: selectedSection,
    })
    const parsed = parseYamahaStyle(rendered)
    const channel = lane === "bass" ? 10 : 9
    preview.current?.play(
      extractStyleSectionPreviewEvents(parsed, selectedSection, [channel]),
      parsed.ticksPerQuarter,
      120,
    )
    setPreviewing(lane)
    setEngagements((value) => value + 1)
  }

  const stopPreview = () => {
    preview.current?.stop()
    setPreviewing(null)
  }

  const saveCurrentSection = () => {
    if (!workingStyle || !bass || !drums || !selectedSection || !draftBytes) return
    const recipe = currentRecipe()
    if (!recipe) return
    const next = parseYamahaStyle(draftBytes)
    setWorkingStyle(next)
    setSavedRecipes((recipes) => ({
      ...recipes,
      [selectedSection.id]: recipe,
    }))
    setDraftRecipes((recipes) => ({
      ...recipes,
      [selectedSection.id]: recipe,
    }))
    setNotice(`${selectedSection.label} saved into your new style.`)
    setEngagements((value) => value + 1)
  }

  const selectSection = (nextSectionId: string) => {
    stopPreview()
    const leaving = currentRecipe()
    if (selectedSection && leaving) {
      setDraftRecipes((recipes) => ({
        ...recipes,
        [selectedSection.id]: leaving,
      }))
    }
    setSectionId(nextSectionId)
    const nextRecipe = draftRecipes[nextSectionId] || savedRecipes[nextSectionId]
    if (nextRecipe) {
      setBassId(nextRecipe.bassId)
      setDrumsId(nextRecipe.drumsId)
    } else {
      setBassId(bassParts[0].id)
      setDrumsId(drumParts[0].id)
    }
  }

  const exportFile = () => {
    if (!exportBytes || !donorFile || !hasSavedSections) {
      setNotice("Save at least one Main section before downloading your new style.")
      return
    }
    const downloadBytes = new Uint8Array(exportBytes.length)
    downloadBytes.set(exportBytes)
    const blob = new Blob([downloadBytes.buffer], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `SmartBridge_${donorFile.name}`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const loadToKeyboard = async () => {
    if (!exportBytes || !hasSavedSections) {
      setNotice("Save at least one Main section before loading the style to your keyboard.")
      return
    }
    if (!midi.connected || !midi.profile) {
      setNotice("Connect a supported Yamaha keyboard and finish the style first.")
      return
    }
    setTransferComplete("")
    setTransfer({ phase: "initializing", percent: 1, message: "Preparing your style" })
    const transferClient = new MusicsoftTransfer(session, setTransfer)
    try {
      const result = await transferClient.transferStyle(exportBytes, "SmartBridgeDemo.prs")
      if (midi.profile.oneClickActivation) {
        setTransfer({
          phase: "activating",
          percent: 90,
          message: "Style transferred. One-click activation awaits hardware validation.",
        })
      }
      setTransfer({ phase: "complete", percent: 100, message: "Style is on your keyboard" })
      setTransferComplete(
        midi.profile.oneClickActivation
          ? `${result.displayPath} transferred. Select it from USER styles for this validation build.`
          : `${result.displayPath} transferred. Automatic activation is not claimed for ${midi.profile.displayName}.`,
      )
      setEngagements((value) => value + 2)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Transfer failed.")
      setTransfer(null)
    }
  }

  const applyRecordedTake = (take: SectionRecordTake) => {
    const style = workingStyleRef.current
    if (!style || !selectedSection || !donor) return
    const sectionTicks = Math.max(
      1,
      selectedSection.endTick - selectedSection.startTick,
    )
    const lanes: Partial<Record<number, { notes: MidiNote[]; cycleTicks: number }>> = {}
    take.laneNotes.forEach((notes, laneIndex) => {
      if (!notes.length || !channelsEnabled[laneIndex]) return
      lanes[laneIndex] = { notes, cycleTicks: sectionTicks }
    })
    const bytes = replaceStyleSectionLanes(style, {
      range: selectedSection,
      lanes,
    })
    const next = parseYamahaStyle(bytes)
    setWorkingStyle(next)
    workingStyleRef.current = next

    const rhythmNotes = take.laneNotes[0] || []
    const bassNotes = take.laneNotes[2] || []
    if (rhythmNotes.length) {
      setCustomDrums({
        id: "custom",
        name: `Recorded ${STYLE_CHANNEL_NAMES[0]}`,
        custom: true,
        notes: rhythmNotes,
        cycleTicks: sectionTicks,
      })
      setDrumsId("custom")
    }
    if (bassNotes.length) {
      setCustomBass({
        id: "custom",
        name: `Recorded ${STYLE_CHANNEL_NAMES[2]}`,
        custom: true,
        notes: bassNotes,
        cycleTicks: sectionTicks,
      })
      setBassId("custom")
    }

    if (dragMidiUrl.current) URL.revokeObjectURL(dragMidiUrl.current)
    const midiCopy = new Uint8Array(take.midiBytes)
    const blob = new Blob([midiCopy.buffer], { type: "audio/midi" })
    dragMidiUrl.current = URL.createObjectURL(blob)
    setRecordTake(take)
    setRecordPhase("drag")
    setRecordStatus("Recording complete! Drag the DRAG button to export.")
    setEngagements((value) => value + 2)
  }

  const changeStyle = (next: StyleCatalogEntry) => {
    setStyleKey(entryKey(next))
    setStyleSearch(next.name)
    if (midi.profile && midi.connected) {
      // Same as JamScheduler.changeStyle → styleSelectCommand on both ports.
      session.sendBoth(styleSelectCommand(styleMappingForEntry(midi.profile, next)))
      setNotice(`${next.name} selected on your ${midi.profile.displayName}.`)
      setEngagements((value) => value + 1)
    }
  }

  const startSectionRecord = () => {
    if (!midi.connected || !selectedSection || !donor || !recorder.current) {
      setNotice("Connect the Yamaha keyboard and choose a Main section first.")
      return
    }
    stopPreview()
    try {
      // Same as JamScheduler.start: re-send the selected factory style before arranging.
      if (midi.profile && selectedStyle) {
        session.sendBoth(styleSelectCommand(styleMappingForEntry(midi.profile, selectedStyle)))
      }
      setRecordPhase("recording")
      setRecordTake(null)
      setRecordStatus("Recording…")
      recorder.current.start({
        variation: mainLabelToVariation(selectedSection.label),
        sectionTicks: Math.max(1, selectedSection.endTick - selectedSection.startTick),
        ticksPerQuarter: donor.ticksPerQuarter,
        bpm: 120,
        channelsEnabled: [...channelsEnabled],
        onAutoStop: (take) => {
          if (!take || !take.events.length) {
            setRecordPhase("idle")
            setRecordStatus("")
            setNotice("No style-engine MIDI was captured on channels 9–16.")
            return
          }
          applyRecordedTake(take)
        },
      })
      setEngagements((value) => value + 1)
    } catch (error) {
      setRecordPhase("idle")
      setRecordStatus("")
      setNotice(error instanceof Error ? error.message : "Recording could not start.")
    }
  }

  const stopSectionRecord = () => {
    if (!recorder.current?.isRecording) return
    try {
      const take = recorder.current.stop()
      if (!take || !take.events.length) {
        setRecordPhase("idle")
        setRecordStatus("")
        setNotice("No style-engine MIDI was captured on channels 9–16.")
        return
      }
      applyRecordedTake(take)
    } catch (error) {
      setRecordPhase("idle")
      setNotice(error instanceof Error ? error.message : "Recording failed.")
    }
  }

  const onRecordDragStart = (event: DragEvent<HTMLButtonElement>) => {
    if (!recordTake || !dragMidiUrl.current) {
      event.preventDefault()
      return
    }
    const fileName = `SECTION_Main_${recordTake.variation}_SmartBridge.mid`
    const url = dragMidiUrl.current
    event.dataTransfer.effectAllowed = "copy"
    event.dataTransfer.setData(
      "DownloadURL",
      `audio/midi:${fileName}:${url}`,
    )
    event.dataTransfer.setData("text/uri-list", url)
    event.dataTransfer.setData("text/plain", fileName)
  }

  const downloadRecordedMidi = () => {
    if (!recordTake || !dragMidiUrl.current) return
    const anchor = document.createElement("a")
    anchor.href = dragMidiUrl.current
    anchor.download = `SECTION_Main_${recordTake.variation}_SmartBridge.mid`
    anchor.click()
  }

  const acceptDonorFile = (file: File | undefined | null) => {
    if (!file) return
    void uploadDonor(file)
    if (donorInput.current) donorInput.current.value = ""
  }

  const onDonorDrag = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.type === "dragenter" || event.type === "dragover") {
      setDropActive(true)
    }
    if (event.type === "dragleave") {
      setDropActive(false)
    }
  }

  const onDonorDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDropActive(false)
    const file = event.dataTransfer.files?.[0]
    acceptDonorFile(file)
  }

  const activeBassPart = bassParts.find((part) => part.id === bassId)
  const activeDrumPart = drumParts.find((part) => part.id === drumsId)
  const saveLabel = selectedSection
    ? sectionDirty
      ? `Save ${selectedSection.label}`
      : `${selectedSection.label} saved`
    : "Save section"

  return (
    <DemoShell
      title="Style Maker"
      eyebrow="Improve any Yamaha style"
      step="Upload · Replace · Save sections · Load"
      onSafeStop={stopPreview}
    >
      <div className="style-maker-layout">
        <section className="style-maker-hero">
          <div>
            <span className="demo-eyebrow">A better style in under 30 seconds</span>
            <h1>Keep the Yamaha magic.<br />Replace what needs fresh energy.</h1>
          </div>
          <div className="style-steps" aria-label="Style Maker progress">
            {["Upload", "Bass", "Drums", "Save", "Load"].map((step, index) => (
              <span key={step} className={(donor ? 1 : 0) + (hasSavedSections ? 3 : 0) >= index ? "is-active" : ""}>
                <i>{index + 1}</i>{step}
              </span>
            ))}
          </div>
        </section>

        <section className="style-maker-style-pick" aria-label="Yamaha factory style">
          <div className="panel-heading">
            <div>
              <span className="demo-eyebrow">Factory style</span>
              <h2>Pick the Yamaha style</h2>
            </div>
            <p>Same catalog as Jam Player — selects the style on your keyboard via SysEx.</p>
          </div>
          <div className="style-catalog-controls">
            <input
              type="search"
              list="style-maker-yamaha-style-suggestions"
              value={styleSearch}
              placeholder={`Search ${availableStyles.length} styles`}
              aria-label="Search styles"
              autoComplete="off"
              onChange={(event) => {
                const value = event.target.value
                setStyleSearch(value)
                const exact = availableStyles.find(
                  (style) => style.name.toLowerCase() === value.trim().toLowerCase(),
                )
                if (exact) changeStyle(exact)
              }}
            />
            <datalist id="style-maker-yamaha-style-suggestions">
              {filteredStyles.map((style) => (
                <option key={entryKey(style)} value={style.name}>
                  {style.category}
                </option>
              ))}
            </datalist>
            <select
              value={styleCategory}
              aria-label="Style category"
              onChange={(event) => setStyleCategory(event.target.value)}
            >
              {styleCategories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              value={selectedStyleVisible && selectedStyle ? entryKey(selectedStyle) : ""}
              aria-label="Yamaha style"
              onChange={(event) => {
                const next = availableStyles.find((style) => entryKey(style) === event.target.value)
                if (next) changeStyle(next)
              }}
            >
              <option value="" disabled>
                {filteredStyles.length ? "Choose a matching style" : "No matching styles"}
              </option>
              {filteredStyles.map((style) => (
                <option key={entryKey(style)} value={entryKey(style)}>
                  {style.name}
                  {style.bpm ? ` · ${style.bpm} BPM` : ""}
                </option>
              ))}
            </select>
            <span>{selectedStyle?.name || "No style available"}</span>
          </div>
        </section>

        {!donor ? (
          <div
            className={`style-dropzone${dropActive ? " is-drop-active" : ""}`}
            role="button"
            tabIndex={0}
            aria-label="Drop your Yamaha style here, or press Enter to browse"
            onDragEnter={onDonorDrag}
            onDragOver={onDonorDrag}
            onDragLeave={onDonorDrag}
            onDrop={onDonorDrop}
            onClick={() => donorInput.current?.click()}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                donorInput.current?.click()
              }
            }}
          >
            <input
              ref={donorInput}
              type="file"
              accept=".sty,.prs,.sst,.mid,.midi,audio/midi,application/octet-stream"
              onChange={(event) => acceptDonorFile(event.target.files?.[0])}
              onClick={(event) => event.stopPropagation()}
            />
            <span className="style-drop-icon"><Upload size={30} /></span>
            <strong>Drop your Yamaha style here</strong>
            <p>Or click to browse. Your donor stays in browser memory — nothing is uploaded to a server.</p>
            <small>.sty · .prs · .sst</small>
          </div>
        ) : (
          <>
            <section className="donor-summary">
              <span className="style-file-icon"><FileMusic size={24} /></span>
              <div>
                <small>Donor style</small>
                <strong>{donorFile?.name}</strong>
                <span>
                  {donor.tracks.length} MIDI track{donor.tracks.length === 1 ? "" : "s"} · CASM/OTS/MDB tail preserved ({donor.yamahaTail.length.toLocaleString()} bytes)
                  {hasSavedSections ? ` · Saved ${savedSectionLabels.join(", ")}` : ""}
                </span>
              </div>
              <label className="style-section-picker">
                <span>Section</span>
                <select
                  value={selectedSection?.id || ""}
                  aria-label="Style Maker section"
                  onChange={(event) => selectSection(event.target.value)}
                >
                  {styleSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {savedRecipes[section.id] ? `${section.label} (saved)` : section.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={`style-section-save${sectionDirty ? "" : " is-saved"}`}
                onClick={saveCurrentSection}
                disabled={!sectionDirty || !draftBytes}
                aria-label={saveLabel}
              >
                {sectionDirty ? <Save size={15} /> : <Check size={15} />}
                {saveLabel}
              </button>
              <label className="replace-file">
                Choose another
                <input type="file" accept=".sty,.prs,.sst" onChange={(event) => event.target.files?.[0] && uploadDonor(event.target.files[0])} />
              </label>
            </section>

            <section className="section-record-panel" aria-label="Record section">
              <div className="section-record-copy">
                <span className="demo-eyebrow">Record This Section</span>
                <strong>Capture style-engine parts on channels 9–16</strong>
                <p>
                  {recordStatus ||
                    "Same as desktop Jam Player: record what the Yamaha style engine plays for this Main, then drag the take into Cubase."}
                </p>
              </div>
              <div className="section-record-channels" role="group" aria-label="Style channels">
                {STYLE_CHANNEL_NAMES.map((name, index) => (
                  <label key={name}>
                    <input
                      type="checkbox"
                      checked={channelsEnabled[index]}
                      disabled={recordPhase === "recording"}
                      onChange={() =>
                        setChannelsEnabled((flags) =>
                          flags.map((value, flagIndex) => (flagIndex === index ? !value : value)),
                        )
                      }
                    />
                    {name}
                  </label>
                ))}
              </div>
              <div className="section-record-actions">
                {recordPhase === "idle" && (
                  <button
                    type="button"
                    className="section-record-button"
                    onClick={startSectionRecord}
                    disabled={!midi.connected}
                  >
                    <Circle size={14} fill="currentColor" /> Record
                  </button>
                )}
                {recordPhase === "recording" && (
                  <button type="button" className="section-record-button is-recording" onClick={stopSectionRecord}>
                    <Square size={14} fill="currentColor" /> Stop
                  </button>
                )}
                {recordPhase === "drag" && recordTake && (
                  <>
                    <button
                      type="button"
                      className="section-record-button is-drag"
                      draggable
                      onDragStart={onRecordDragStart}
                      onClick={downloadRecordedMidi}
                      aria-label="DRAG recorded section MIDI to Cubase"
                    >
                      <GripVertical size={15} /> DRAG
                    </button>
                    <button type="button" className="btn-secondary" onClick={startSectionRecord}>
                      Record again
                    </button>
                  </>
                )}
              </div>
            </section>

            <div className="lane-editor-grid">
              <section className="lane-editor">
                <header>
                  <div><span>BASS</span><strong>{bass?.name}</strong></div>
                  <div className="lane-audition-controls">
                    <button type="button" onClick={() => playLane("bass")}>
                      <Play size={13} fill="currentColor" /> Start
                    </button>
                    <button type="button" onClick={stopPreview} disabled={previewing !== "bass"}>
                      <Square size={12} fill="currentColor" /> Stop
                    </button>
                  </div>
                  <label className="midi-upload"><Upload size={14} /> Your MIDI<input type="file" accept=".mid,.midi" onChange={(event) => event.target.files?.[0] && uploadLane(event.target.files[0], "bass")} /></label>
                </header>
                <div className="part-carousel">
                  {bassParts.map((part) => (
                    <button key={part.id} type="button" className={part.id === bassId ? "is-active" : ""} title="Double-click to audition" onDoubleClick={() => playLane("bass", part.id)} onClick={() => { setBassId(part.id); setEngagements((value) => value + 1) }}>
                      <span>{part.genre}</span><strong>{part.name}</strong><RhythmGlyph part={part} active={part.id === bassId} />
                    </button>
                  ))}
                  {customBass && <button type="button" title="Double-click to audition" className={bassId === "custom" ? "is-active" : ""} onDoubleClick={() => playLane("bass", "custom")} onClick={() => setBassId("custom")}><span>Your MIDI</span><strong>{customBass.name}</strong></button>}
                </div>
              </section>

              <section className="lane-editor">
                <header>
                  <div><span>DRUMS</span><strong>{drums?.name}</strong></div>
                  <div className="lane-audition-controls">
                    <button type="button" onClick={() => playLane("drums")}>
                      <Play size={13} fill="currentColor" /> Start
                    </button>
                    <button type="button" onClick={stopPreview} disabled={previewing !== "drums"}>
                      <Square size={12} fill="currentColor" /> Stop
                    </button>
                  </div>
                  <label className="midi-upload"><Upload size={14} /> Your MIDI<input type="file" accept=".mid,.midi" onChange={(event) => event.target.files?.[0] && uploadLane(event.target.files[0], "drums")} /></label>
                </header>
                <div className="part-carousel">
                  {drumParts.map((part) => (
                    <button key={part.id} type="button" className={part.id === drumsId ? "is-active" : ""} title="Double-click to audition" onDoubleClick={() => playLane("drums", part.id)} onClick={() => { setDrumsId(part.id); setEngagements((value) => value + 1) }}>
                      <span>{part.genre}</span><strong>{part.name}</strong><RhythmGlyph part={part} active={part.id === drumsId} />
                    </button>
                  ))}
                  {customDrums && <button type="button" title="Double-click to audition" className={drumsId === "custom" ? "is-active" : ""} onDoubleClick={() => playLane("drums", "custom")} onClick={() => setDrumsId("custom")}><span>Your MIDI</span><strong>{customDrums.name}</strong></button>}
                </div>
              </section>
            </div>

            <section className="compare-panel">
              <div>
                <span className="demo-eyebrow">Before & after</span>
                <h2>Hear the difference on your keyboard.</h2>
                <p>Save each Main A–D section into your new style file, then download or load the combined result.</p>
              </div>
              <div className="compare-actions">
                <button type="button" className={previewing === "original" ? "is-playing" : ""} onClick={() => playVersion("original")}>
                  <Play size={18} fill="currentColor" />
                  <span><small>BEFORE · START</small><strong>Original style</strong></span>
                </button>
                <button type="button" className="compare-stop" onClick={stopPreview} disabled={!previewing}>
                  <Square size={16} fill="currentColor" /> Stop
                </button>
                <button type="button" className={`is-after${previewing === "modified" ? " is-playing" : ""}`} onClick={() => playVersion("modified")}>
                  <Play size={18} fill="currentColor" />
                  <span><small>AFTER · START</small><strong>{activeBassPart?.name || bass?.name} + {activeDrumPart?.name || drums?.name}</strong></span>
                </button>
              </div>
            </section>

            {notice && <div className="demo-status" role="status">{notice}</div>}
            <section className="style-final-bar">
              <button className="btn-secondary" type="button" onClick={exportFile} disabled={!hasSavedSections}>
                <Download size={17} /> Download style
              </button>
              <div>
                <span><WandSparkles size={17} /> Ready for your Yamaha</span>
                <small>
                  {hasSavedSections
                    ? `New style includes ${savedSectionLabels.join(", ")}`
                    : "Save Main A–D sections into your new style file"}
                </small>
              </div>
              <button className="load-keyboard-button" type="button" onClick={loadToKeyboard} disabled={!hasSavedSections}>
                Load to Keyboard <ArrowRight size={19} />
              </button>
            </section>
          </>
        )}
        {notice && !donor && <div className="demo-status is-error">{notice}</div>}
      </div>

      {transfer && (
        <div className="transfer-overlay" role="dialog" aria-modal="true" aria-label="Loading style to keyboard">
          <div className={`transfer-card${transfer.phase === "complete" ? " is-complete" : ""}`}>
            <span className="transfer-icon">
              {transfer.phase === "complete" ? <Check size={34} /> : <LoaderCircle size={34} />}
            </span>
            <span className="demo-eyebrow">{transfer.phase === "complete" ? "Your new band is ready" : "Load to Keyboard"}</span>
            <h2>{transfer.message}</h2>
            <p>{transferComplete || "Keep the browser open and do not disconnect the USB cable."}</p>
            <div className="transfer-progress"><i style={{ width: `${transfer.percent}%` }} /></div>
            <strong>{Math.round(transfer.percent)}%</strong>
            {transfer.phase === "complete" && (
              <button className="btn-primary" type="button" onClick={() => setTransfer(null)}>Return to Style Maker</button>
            )}
          </div>
        </div>
      )}
      <FeedbackPrompt meaningfulActions={engagements} />
    </DemoShell>
  )
}
