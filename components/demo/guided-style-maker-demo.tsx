"use client"

import { ArrowLeft, Check, FileMusic, LoaderCircle, Play, Square, Upload } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import partCatalog from "@/data/demo/style-parts.json"
import { DemoShell } from "@/components/demo/demo-shell"
import { FeedbackPrompt } from "@/components/demo/feedback-prompt"
import {
  extractMidiNotes,
  extractStylePreviewEvents,
  parseYamahaStyle,
  patternToMidiNotes,
  replaceStyleLanes,
  type MidiNote,
  type ParsedYamahaStyle,
} from "@/lib/demo/style-midi"
import { StylePreviewPlayer } from "@/lib/demo/style-preview"
import type { TransferProgress } from "@/lib/demo/types"
import { MusicsoftTransfer } from "@/lib/demo/yamaha/musicsoft-transfer"
import { useMidiSession } from "@/lib/demo/yamaha/use-midi-session"

type Part = { id: string; name: string; genre: string; bars: number; notes: number[][] }
type LaneSource = { id: string; name: string; notes: MidiNote[]; cycleTicks: number }
const bassParts = partCatalog.bass as Part[]
const drumParts = partCatalog.drums as Part[]

export function GuidedStyleMakerDemo() {
  const [session, midi] = useMidiSession()
  const [step, setStep] = useState(2)
  const [donorFile, setDonorFile] = useState<File | null>(null)
  const [donor, setDonor] = useState<ParsedYamahaStyle | null>(null)
  const [bassId, setBassId] = useState(bassParts[0].id)
  const [drumsId, setDrumsId] = useState(drumParts[0].id)
  const [customBass, setCustomBass] = useState<LaneSource | null>(null)
  const [customDrums, setCustomDrums] = useState<LaneSource | null>(null)
  const [notice, setNotice] = useState("")
  const [previewing, setPreviewing] = useState<"original" | "new" | null>(null)
  const [transfer, setTransfer] = useState<TransferProgress | null>(null)
  const [complete, setComplete] = useState("")
  const [engagements, setEngagements] = useState(0)
  const preview = useRef<StylePreviewPlayer | null>(null)

  useEffect(() => {
    preview.current = new StylePreviewPlayer(session, () => setPreviewing(null))
    return () => preview.current?.stop()
  }, [session])

  const bass = useMemo<LaneSource | null>(() => {
    if (!donor) return null
    if (bassId === "custom") return customBass
    const part = bassParts.find((item) => item.id === bassId)
    return part ? {
      id: part.id, name: part.name,
      notes: patternToMidiNotes(part.notes, donor.ticksPerQuarter),
      cycleTicks: part.bars * 4 * donor.ticksPerQuarter,
    } : null
  }, [bassId, customBass, donor])

  const drums = useMemo<LaneSource | null>(() => {
    if (!donor) return null
    if (drumsId === "custom") return customDrums
    const part = drumParts.find((item) => item.id === drumsId)
    return part ? {
      id: part.id, name: part.name,
      notes: patternToMidiNotes(part.notes, donor.ticksPerQuarter),
      cycleTicks: part.bars * 4 * donor.ticksPerQuarter,
    } : null
  }, [customDrums, donor, drumsId])

  const modified = useMemo(() => {
    if (!donor || !bass || !drums) return null
    try { return replaceStyleLanes(donor, { bass, drums }) }
    catch { return null }
  }, [bass, donor, drums])

  const uploadStyle = async (file: File) => {
    try {
      const parsed = parseYamahaStyle(new Uint8Array(await file.arrayBuffer()))
      if (!parsed.yamahaTail.length) throw new Error("Please choose an original Yamaha style file.")
      setDonorFile(file)
      setDonor(parsed)
      setNotice("")
      setStep(3)
      setEngagements((value) => value + 1)
    } catch {
      setNotice("We could not read that file. Please choose a Yamaha .sty, .prs, or .sst file.")
    }
  }

  const uploadPart = async (file: File, lane: "bass" | "drums") => {
    if (!donor) return
    try {
      const extracted = extractMidiNotes(new Uint8Array(await file.arrayBuffer()))
      const ratio = donor.ticksPerQuarter / extracted.ticksPerQuarter
      const source: LaneSource = {
        id: "custom",
        name: file.name,
        notes: extracted.notes.map((note) => ({
          ...note,
          tick: Math.round(note.tick * ratio),
          duration: Math.max(1, Math.round(note.duration * ratio)),
        })),
        cycleTicks: Math.round(extracted.cycleTicks * ratio),
      }
      if (lane === "bass") { setCustomBass(source); setBassId("custom") }
      else { setCustomDrums(source); setDrumsId("custom") }
      setNotice("")
    } catch {
      setNotice("We could not read that MIDI file. Please choose another one.")
    }
  }

  const play = (version: "original" | "new") => {
    if (!donor || (version === "new" && !modified)) return
    preview.current?.stop()
    const parsed = version === "original" ? donor : parseYamahaStyle(modified!)
    preview.current?.play(extractStylePreviewEvents(parsed), parsed.ticksPerQuarter, 120)
    setPreviewing(version)
    setEngagements((value) => value + 1)
  }

  const stop = () => { preview.current?.stop(); setPreviewing(null) }

  const load = async () => {
    if (!modified || !midi.profile) return
    setTransfer({ phase: "initializing", percent: 1, message: "Preparing your new style" })
    try {
      const result = await new MusicsoftTransfer(session, setTransfer).transferStyle(
        modified, "SmartBridgeDemo.prs",
      )
      setComplete(`${result.displayPath} is now on your keyboard.`)
      setTransfer({ phase: "complete", percent: 100, message: "Your new style is ready" })
      setEngagements((value) => value + 2)
    } catch {
      setTransfer(null)
      setNotice("The style could not be loaded. Check the USB cable and try again.")
    }
  }

  const progress = ["Connected", "Style file", "Bass", "Drums", "Load"]
  const parts = step === 3 ? bassParts : drumParts
  const selectedId = step === 3 ? bassId : drumsId

  return (
    <DemoShell title="Style Maker" eyebrow="Improve a Yamaha style" step="Five easy steps" onSafeStop={stop}>
      <div className="guided-demo-page">
        <nav className="guided-progress" aria-label="Style Maker progress">
          {progress.map((label, index) => (
            <span key={label} className={index + 1 < step ? "is-complete" : index + 1 === step ? "is-current" : ""}>
              <i>{index + 1}</i>{label}
            </span>
          ))}
        </nav>

        <section className="guided-card">
          <span className="demo-eyebrow">Step {step} of 5</span>
          {step === 2 && (
            <>
              <h1>Choose your Yamaha style file</h1>
              <p className="guided-instruction">The file stays on this computer. It is never uploaded to the internet.</p>
              <label className="senior-file-button">
                <Upload size={30} /><strong>Choose Yamaha style file</strong>
                <span>.sty, .prs, or .sst</span>
                <input type="file" accept=".sty,.prs,.sst" onChange={(event) => event.target.files?.[0] && uploadStyle(event.target.files[0])} />
              </label>
            </>
          )}

          {(step === 3 || step === 4) && (
            <>
              <button className="senior-back-button" type="button" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={20} /> Back
              </button>
              <h1>{step === 3 ? "Choose a new bass" : "Choose new drums"}</h1>
              <p className="guided-instruction">Press one large button. You can change your choice at any time.</p>
              <div className="senior-part-grid">
                {parts.map((part) => (
                  <button key={part.id} type="button" className={part.id === selectedId ? "is-selected" : ""}
                    onClick={() => step === 3 ? setBassId(part.id) : setDrumsId(part.id)}>
                    <span className="selection-light" /><small>{part.genre}</small><strong>{part.name}</strong>
                  </button>
                ))}
                {(step === 3 ? customBass : customDrums) && (
                  <button type="button" className={selectedId === "custom" ? "is-selected" : ""}
                    onClick={() => step === 3 ? setBassId("custom") : setDrumsId("custom")}>
                    <span className="selection-light" /><small>Your MIDI</small>
                    <strong>{(step === 3 ? customBass : customDrums)?.name}</strong>
                  </button>
                )}
              </div>
              <label className="senior-secondary-action">
                <Upload size={20} /> Use my own MIDI file
                <input type="file" accept=".mid,.midi" onChange={(event) => event.target.files?.[0] && uploadPart(event.target.files[0], step === 3 ? "bass" : "drums")} />
              </label>
              <button className="senior-primary-action" type="button" onClick={() => setStep(step + 1)}>
                Continue
              </button>
            </>
          )}

          {step === 5 && (
            <>
              <button className="senior-back-button" type="button" onClick={() => setStep(4)}>
                <ArrowLeft size={20} /> Back
              </button>
              <FileMusic size={46} />
              <h1>Your improved style is ready</h1>
              <p className="guided-instruction">{donorFile?.name}<br />New bass: {bass?.name}<br />New drums: {drums?.name}</p>
              <div className="senior-compare-actions">
                <button type="button" onClick={() => previewing === "original" ? stop() : play("original")}>
                  {previewing === "original" ? <Square /> : <Play />} Hear original
                </button>
                <button type="button" onClick={() => previewing === "new" ? stop() : play("new")}>
                  {previewing === "new" ? <Square /> : <Play />} Hear new style
                </button>
              </div>
              <button className="load-keyboard-button senior-load-button" type="button" onClick={load}>
                Load to my keyboard
              </button>
            </>
          )}
          {notice && <div className="demo-status is-error" role="status">{notice}</div>}
        </section>
      </div>

      {transfer && (
        <div className="transfer-overlay" role="dialog" aria-modal="true" aria-label="Loading style to keyboard">
          <div className={`transfer-card${transfer.phase === "complete" ? " is-complete" : ""}`}>
            <span className="transfer-icon">{transfer.phase === "complete" ? <Check size={34} /> : <LoaderCircle size={34} />}</span>
            <h2>{transfer.message}</h2>
            <p>{complete || "Keep this page open and leave the USB cable connected."}</p>
            <div className="transfer-progress"><i style={{ width: `${transfer.percent}%` }} /></div>
            <strong>{Math.round(transfer.percent)}%</strong>
            {transfer.phase === "complete" && <button className="senior-primary-action" type="button" onClick={() => setTransfer(null)}>Done</button>}
          </div>
        </div>
      )}
      <FeedbackPrompt meaningfulActions={engagements} />
    </DemoShell>
  )
}
