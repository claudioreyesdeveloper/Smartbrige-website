"use client"

import {
  ArrowRight,
  Check,
  Download,
  FileMusic,
  LoaderCircle,
  Play,
  Square,
  Upload,
  WandSparkles,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
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
  type MidiNote,
  type ParsedYamahaStyle,
  type StyleSectionRange,
  type StyleVoice,
} from "@/lib/demo/style-midi"
import { StylePreviewPlayer } from "@/lib/demo/style-preview"
import { MusicsoftTransfer } from "@/lib/demo/yamaha/musicsoft-transfer"
import { useMidiSession } from "@/lib/demo/yamaha/use-midi-session"
import type { TransferProgress } from "@/lib/demo/types"

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
  voice?: StyleVoice
}

function laneSourceFor(
  id: string,
  parts: Part[],
  custom: LaneSource | null,
  donor: ParsedYamahaStyle | null,
  voice?: StyleVoice & { playedVelocityMax: number },
): LaneSource | null {
  if (!donor) return null
  if (id === "custom") return custom
  const part = parts.find((candidate) => candidate.id === id)
  const notes = part ? patternToMidiNotes(part.notes, donor.ticksPerQuarter) : []
  return part
    ? {
        id: part.id,
        name: part.name,
        notes: voice
          ? notes.map((note) => ({
              ...note,
              velocity: Math.max(
                1,
                Math.min(
                  voice.playedVelocityMax,
                  Math.round(30 + (note.velocity / 127) * (voice.playedVelocityMax - 30)),
                ),
              ),
            }))
          : notes,
        cycleTicks: part.bars * 4 * donor.ticksPerQuarter,
        voice,
      }
    : null
}

const bassParts = partCatalog.bass as Part[]
const drumParts = partCatalog.drums as Part[]
const bassVoice = partCatalog.bassVoice as StyleVoice & { playedVelocityMax: number }

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
  const [bassId, setBassId] = useState(bassParts[0].id)
  const [drumsId, setDrumsId] = useState(drumParts[0].id)
  const [sectionId, setSectionId] = useState("")
  const [customBass, setCustomBass] = useState<LaneSource | null>(null)
  const [customDrums, setCustomDrums] = useState<LaneSource | null>(null)
  const [modified, setModified] = useState<Uint8Array | null>(null)
  const [notice, setNotice] = useState("")
  const [previewing, setPreviewing] = useState<
    "original" | "modified" | "bass" | "drums" | null
  >(null)
  const [transfer, setTransfer] = useState<TransferProgress | null>(null)
  const [transferComplete, setTransferComplete] = useState("")
  const [engagements, setEngagements] = useState(0)
  const preview = useRef<StylePreviewPlayer | null>(null)

  useEffect(() => {
    preview.current = new StylePreviewPlayer(session, () => setPreviewing(null))
    return () => preview.current?.stop()
  }, [session])

  const bass = useMemo<LaneSource | null>(() => {
    return laneSourceFor(bassId, bassParts, customBass, donor, bassVoice)
  }, [bassId, customBass, donor])

  const drums = useMemo<LaneSource | null>(() => {
    return laneSourceFor(drumsId, drumParts, customDrums, donor)
  }, [customDrums, donor, drumsId])

  const styleSections = useMemo(
    () => donor ? extractStyleSections(donor) : [],
    [donor],
  )
  const selectedSection = useMemo<StyleSectionRange | null>(
    () => styleSections.find((section) => section.id === sectionId) || styleSections[0] || null,
    [sectionId, styleSections],
  )

  useEffect(() => {
    if (!donor || !bass || !drums) {
      setModified(null)
      return
    }
    try {
      setModified(replaceStyleLanes(donor, {
        bass,
        drums,
        range: selectedSection || undefined,
      }))
      setNotice("")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not render the modified style.")
    }
  }, [bass, donor, drums, selectedSection])

  const uploadDonor = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const parsed = parseYamahaStyle(bytes)
      if (!parsed.yamahaTail.length) {
        throw new Error("Upload a native Yamaha .sty/.prs file with its CASM tail intact.")
      }
      setDonorFile(file)
      setDonor(parsed)
      setSectionId(extractStyleSections(parsed)[0]?.id || "")
      setNotice("")
      setEngagements((value) => value + 1)
    } catch (error) {
      setDonorFile(null)
      setDonor(null)
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
    if (!donor || !selectedSection || (version === "modified" && !modified)) return
    const parsed = version === "original" ? donor : parseYamahaStyle(modified!)
    preview.current?.play(
      extractStyleSectionPreviewEvents(parsed, selectedSection),
      parsed.ticksPerQuarter,
      120,
    )
    setPreviewing(version)
    setEngagements((value) => value + 1)
  }

  const playLane = (lane: "bass" | "drums", requestedId?: string) => {
    if (!midi.connected || !donor || !selectedSection) {
      setNotice("Connect the Yamaha keyboard and choose a donor style first.")
      return
    }
    const auditionBass = laneSourceFor(
      lane === "bass" && requestedId ? requestedId : bassId,
      bassParts,
      customBass,
      donor,
      bassVoice,
    )
    const auditionDrums = laneSourceFor(
      lane === "drums" && requestedId ? requestedId : drumsId,
      drumParts,
      customDrums,
      donor,
    )
    if (!auditionBass || !auditionDrums) return
    const rendered = replaceStyleLanes(donor, {
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

  const exportFile = () => {
    if (!modified || !donorFile) return
    const downloadBytes = new Uint8Array(modified.length)
    downloadBytes.set(modified)
    const blob = new Blob([downloadBytes.buffer], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `SmartBridge_${donorFile.name}`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const loadToKeyboard = async () => {
    if (!modified || !midi.connected || !midi.profile) {
      setNotice("Connect a supported Yamaha keyboard and finish the style first.")
      return
    }
    setTransferComplete("")
    setTransfer({ phase: "initializing", percent: 1, message: "Preparing your style" })
    const transferClient = new MusicsoftTransfer(session, setTransfer)
    try {
      const result = await transferClient.transferStyle(modified, "SmartBridgeDemo.prs")
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

  const activeBassPart = bassParts.find((part) => part.id === bassId)
  const activeDrumPart = drumParts.find((part) => part.id === drumsId)

  return (
    <DemoShell
      title="Style Maker"
      eyebrow="Improve any Yamaha style"
      step="Upload · Replace · Compare · Load"
      onSafeStop={stopPreview}
    >
      <div className="style-maker-layout">
        <section className="style-maker-hero">
          <div>
            <span className="demo-eyebrow">A better style in under 30 seconds</span>
            <h1>Keep the Yamaha magic.<br />Replace what needs fresh energy.</h1>
          </div>
          <div className="style-steps" aria-label="Style Maker progress">
            {["Upload", "Bass", "Drums", "Compare", "Load"].map((step, index) => (
              <span key={step} className={(donor ? 1 : 0) + (modified ? 3 : 0) >= index ? "is-active" : ""}>
                <i>{index + 1}</i>{step}
              </span>
            ))}
          </div>
        </section>

        {!donor ? (
          <label className="style-dropzone">
            <input
              type="file"
              accept=".sty,.prs,.sst,.mid,.midi"
              onChange={(event) => event.target.files?.[0] && uploadDonor(event.target.files[0])}
            />
            <span className="style-drop-icon"><Upload size={30} /></span>
            <strong>Drop your Yamaha style here</strong>
            <p>Your donor stays in browser memory. Nothing is uploaded to a server.</p>
            <small>.sty · .prs · .sst</small>
          </label>
        ) : (
          <>
            <section className="donor-summary">
              <span className="style-file-icon"><FileMusic size={24} /></span>
              <div>
                <small>Donor style</small>
                <strong>{donorFile?.name}</strong>
                <span>{donor.tracks.length} MIDI track{donor.tracks.length === 1 ? "" : "s"} · CASM/OTS/MDB tail preserved ({donor.yamahaTail.length.toLocaleString()} bytes)</span>
              </div>
              <label className="style-section-picker">
                <span>Section</span>
                <select
                  value={selectedSection?.id || ""}
                  aria-label="Style Maker section"
                  onChange={(event) => {
                    stopPreview()
                    setSectionId(event.target.value)
                  }}
                >
                  {styleSections.map((section) => (
                    <option key={section.id} value={section.id}>{section.label}</option>
                  ))}
                </select>
              </label>
              <label className="replace-file">
                Choose another
                <input type="file" accept=".sty,.prs,.sst" onChange={(event) => event.target.files?.[0] && uploadDonor(event.target.files[0])} />
              </label>
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
                <p>SmartBridge streams the style parts on Yamaha channels 9–16 without changing your donor’s native CASM tail.</p>
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
              <button className="btn-secondary" type="button" onClick={exportFile}><Download size={17} /> Download style</button>
              <div>
                <span><WandSparkles size={17} /> Ready for your Yamaha</span>
                <small>{midi.profile?.oneClickActivation ? "Genos activation is hardware-gated" : "Transfers into USER:\\STYLE"}</small>
              </div>
              <button className="load-keyboard-button" type="button" onClick={loadToKeyboard} disabled={!modified}>
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
