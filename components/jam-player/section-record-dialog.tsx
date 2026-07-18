"use client"

/**
 * Desktop JamPlayerScreen::SectionRecordDialog — popup to configure and run
 * a style-engine section capture (channels 9–16), then DRAG the .mid out.
 */

import { Circle, Download, GripVertical, Square, X } from "lucide-react"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react"
import { createPortal } from "react-dom"
import {
  dragBridgeHealth,
  prepareDragViaBridge,
} from "@/lib/drag-bridge/client"
import { getMidiSession } from "@/lib/yamaha"
import {
  chromeDownloadUrlPayload,
  setChromeMidiDragData,
} from "@/lib/yamaha/drag-midi-file"
import {
  SectionRecorder,
  STYLE_CHANNEL_NAMES,
  type SectionFillIn,
  type SectionRecordTake,
} from "@/lib/yamaha/section-record"
import type { ArrangerSection } from "@/lib/yamaha/types"
import type { JamSongSection, MainVariation } from "./types"

export type SectionRecordDialogProps = {
  section: JamSongSection
  songTitle: string
  tempo: number
  beatsPerBar: number
  open: boolean
  onClose: () => void
}

type Phase = "idle" | "recording" | "drag"

const VARIATIONS: { value: ArrangerSection; label: string }[] = [
  { value: "A", label: "Main A" },
  { value: "B", label: "Main B" },
  { value: "C", label: "Main C" },
  { value: "D", label: "Main D" },
]

const FILL_INS: { value: SectionFillIn; label: string }[] = [
  { value: "Off", label: "Off" },
  { value: "A", label: "Fill-In A" },
  { value: "B", label: "Fill-In B" },
  { value: "C", label: "Fill-In C" },
  { value: "D", label: "Fill-In D" },
  { value: "Break", label: "Break" },
]

function defaultVariation(section: JamSongSection): ArrangerSection {
  const v = section.variation as MainVariation
  return VARIATIONS.some((item) => item.value === v) ? v : "A"
}

export function SectionRecordDialog({
  section,
  songTitle,
  tempo,
  beatsPerBar,
  open,
  onClose,
}: SectionRecordDialogProps) {
  const recorderRef = useRef<SectionRecorder | null>(null)
  const takeUrlRef = useRef<string | null>(null)
  const takeFileRef = useRef<File | null>(null)
  const chromeDragPayloadRef = useRef<string | null>(null)

  const [variation, setVariation] = useState<ArrangerSection>(() =>
    defaultVariation(section),
  )
  const [fillIn, setFillIn] = useState<SectionFillIn>("Off")
  const [includeControlData, setIncludeControlData] = useState(false)
  const [channelsEnabled, setChannelsEnabled] = useState(() =>
    Array.from({ length: 8 }, () => true),
  )
  const [phase, setPhase] = useState<Phase>("idle")
  const [take, setTake] = useState<SectionRecordTake | null>(null)
  const [takeObjectUrl, setTakeObjectUrl] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [mounted, setMounted] = useState(false)
  const [bridgeOnline, setBridgeOnline] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const ping = async () => {
      const health = await dragBridgeHealth()
      if (!cancelled) setBridgeOnline(Boolean(health?.ok))
    }
    void ping()
    const id = window.setInterval(() => void ping(), 4000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [open])

  const revokeTakeUrl = () => {
    if (takeUrlRef.current) {
      URL.revokeObjectURL(takeUrlRef.current)
      takeUrlRef.current = null
    }
    takeFileRef.current = null
    chromeDragPayloadRef.current = null
    setTakeObjectUrl(null)
  }

  const resetForSection = useCallback(() => {
    recorderRef.current?.cancel()
    recorderRef.current = null
    revokeTakeUrl()
    setVariation(defaultVariation(section))
    setFillIn("Off")
    setIncludeControlData(false)
    setChannelsEnabled(Array.from({ length: 8 }, () => true))
    setPhase("idle")
    setTake(null)
    setStatus("")
    setError("")
  }, [section])

  useEffect(() => {
    if (!open) return
    resetForSection()
  }, [open, section.id, resetForSection])

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel()
      revokeTakeUrl()
    }
  }, [])

  const controlsLocked = phase === "recording"

  const finishTake = (next: SectionRecordTake | null) => {
    if (!next || next.events.length === 0) {
      setPhase("idle")
      setTake(null)
      setStatus("No style MIDI was captured. Check that the keyboard style is playing.")
      return
    }
    revokeTakeUrl()
    const bytes = new Uint8Array(next.midiBytes)
    const file = new File([bytes], next.fileName, { type: "audio/midi" })
    takeFileRef.current = file
    const objectUrl = URL.createObjectURL(file)
    takeUrlRef.current = objectUrl
    // Must be ready before dragstart (Chrome DownloadURL is synchronous).
    chromeDragPayloadRef.current = chromeDownloadUrlPayload(next.fileName, bytes)
    setTakeObjectUrl(objectUrl)
    setTake(next)
    setPhase("drag")
    // Push MIDI to the companion immediately so the chip is ready to drag.
    void (async () => {
      const health = await dragBridgeHealth()
      setBridgeOnline(Boolean(health?.ok))
      if (!health?.ok) {
        setStatus(
          "Recording complete. Start SmartBridge Drag Bridge for Cubase drop, or use Download / Desktop drag.",
        )
        return
      }
      try {
        const result = await prepareDragViaBridge({
          fileName: next.fileName,
          midiBytes: bytes,
        })
        if (!result.ok) {
          setStatus(
            "Recording complete. Drag Bridge did not accept the file — try “Drag to Cubase” again, or Download.",
          )
          return
        }
        setStatus(
          "Recording complete. Drag the floating “DRAG TO CUBASE” chip into Cubase.",
        )
      } catch {
        setBridgeOnline(false)
        setStatus(
          "Recording complete. Drag Bridge went offline — restart it, then click “Drag to Cubase”.",
        )
      }
    })()
  }

  const startRecording = () => {
    const session = getMidiSession()
    if (!session.state.connected) {
      setError("Connect your Yamaha keyboard before recording.")
      return
    }
    setError("")
    setStatus("Recording…")
    setPhase("recording")
    setTake(null)
    revokeTakeUrl()

    try {
      const recorder = new SectionRecorder(session)
      recorderRef.current = recorder
      const bpb = beatsPerBar > 0 ? beatsPerBar : 4
      recorder.start({
        variation,
        fillIn,
        sectionBeats: Math.max(1, section.bars * bpb),
        bpm: tempo,
        channelsEnabled,
        includeControlData,
        chords: section.chords,
        chord: section.chords[0]?.name || "C",
        songTitle,
        sectionLabel: section.label,
        onAutoStop: (next) => {
          recorderRef.current = null
          finishTake(next)
        },
      })
    } catch (err) {
      setPhase("idle")
      setError(err instanceof Error ? err.message : "Could not start recording.")
      setStatus("")
    }
  }

  const stopRecording = () => {
    const recorder = recorderRef.current
    if (!recorder) return
    try {
      const next = recorder.stop()
      recorderRef.current = null
      finishTake(next)
    } catch (err) {
      setPhase("idle")
      setError(err instanceof Error ? err.message : "Could not stop recording.")
    }
  }

  const cancelOrClose = () => {
    if (phase === "recording") {
      recorderRef.current?.cancel()
      recorderRef.current = null
      setPhase("idle")
      setStatus("")
    }
    onClose()
  }

  const downloadTake = async () => {
    const file = takeFileRef.current
    if (!file) return

    // Prefer File System Access when available (real path on disk → Cubase).
    const picker = (
      window as Window & {
        showSaveFilePicker?: (options: {
          suggestedName: string
          types: { description: string; accept: Record<string, string[]> }[]
        }) => Promise<FileSystemFileHandle>
      }
    ).showSaveFilePicker

    if (typeof picker === "function") {
      try {
        const handle = await picker({
          suggestedName: file.name,
          types: [
            {
              description: "MIDI file",
              accept: { "audio/midi": [".mid"], "audio/x-midi": [".mid"] },
            },
          ],
        })
        const writable = await handle.createWritable()
        await writable.write(file)
        await writable.close()
        setStatus(`Saved ${file.name}. Drag that file from Finder into Cubase.`)
        return
      } catch (err) {
        // User cancelled picker — fall through to anchor download only on AbortError.
        if (err instanceof DOMException && err.name === "AbortError") return
      }
    }

    if (!takeUrlRef.current) return
    const link = document.createElement("a")
    link.href = takeUrlRef.current
    link.download = file.name
    link.click()
    setStatus("Downloaded. Drag the .mid from Downloads into Cubase.")
  }

  const sendToDragBridge = async () => {
    if (!take || !takeFileRef.current) return
    setError("")
    try {
      const result = await prepareDragViaBridge({
        fileName: take.fileName,
        midiBytes: new Uint8Array(await takeFileRef.current.arrayBuffer()),
      })
      if (!result.ok) {
        setBridgeOnline(false)
        setError(
          "Drag Bridge did not accept the file. Is SmartBridge Drag Bridge running?",
        )
        return
      }
      setBridgeOnline(true)
      setStatus(
        "Drag Bridge ready — drag the floating chip into Cubase (works on Mac and Windows).",
      )
    } catch {
      setBridgeOnline(false)
      setError(
        "Drag Bridge is offline. Run Helpers/SmartBridgeDragBridge (run.sh / run.cmd), then try again.",
      )
    }
  }

  const onDesktopDragStart = (event: DragEvent<HTMLAnchorElement>) => {
    const payload = chromeDragPayloadRef.current
    if (!take || !payload) {
      event.preventDefault()
      return
    }
    // Chrome fallback only (Finder/Desktop). Cubase needs the Drag Bridge chip.
    setChromeMidiDragData(event.dataTransfer, payload, take.fileName)
  }

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="section-record-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && phase !== "recording") {
          cancelOrClose()
        }
      }}
    >
      <div
        className="section-record-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="section-record-title"
      >
        <header className="section-record-dialog-header">
          <button
            type="button"
            className="section-record-dialog-close"
            aria-label="Close"
            disabled={controlsLocked}
            onClick={cancelOrClose}
          >
            <X size={16} />
          </button>
          <h2 id="section-record-title">Record Section</h2>
        </header>

        <div className="section-record-dialog-body">
          <p className="section-record-dialog-section">
            <span>Section</span>
            <strong>{section.label}</strong>
            <small>
              Main {section.variation} · {section.bars} bars · {tempo} BPM
            </small>
          </p>

          <fieldset className="section-record-card" disabled={controlsLocked}>
            <legend>Section</legend>
            <label>
              <span>Style Variation</span>
              <select
                value={variation}
                aria-label="Style Variation"
                onChange={(event) =>
                  setVariation(event.target.value as ArrangerSection)
                }
              >
                {VARIATIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Fill-In</span>
              <select
                value={fillIn}
                aria-label="Fill-In"
                onChange={(event) => setFillIn(event.target.value as SectionFillIn)}
              >
                {FILL_INS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="section-record-check"
              title={
                "When off, the exported MIDI keeps only note on/off on channels 9-16. " +
                "When on, captured CC, program changes, pitch wheel, aftertouch and mapped Yamaha SysEx are also kept."
              }
            >
              <input
                type="checkbox"
                checked={includeControlData}
                onChange={(event) => setIncludeControlData(event.target.checked)}
              />
              <span>Include CC / Controllers</span>
            </label>
          </fieldset>

          <fieldset className="section-record-card" disabled={controlsLocked}>
            <legend>Channels</legend>
            <p className="section-record-channels-label">Channels (9-16):</p>
            <div
              className="section-record-dialog-channels"
              role="group"
              aria-label="Style channels"
            >
              {STYLE_CHANNEL_NAMES.map((name, index) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    checked={channelsEnabled[index]}
                    onChange={() =>
                      setChannelsEnabled((flags) =>
                        flags.map((value, flagIndex) =>
                          flagIndex === index ? !value : value,
                        ),
                      )
                    }
                  />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>

          {(status || error) && (
            <p
              className={`section-record-dialog-status${error ? " is-error" : ""}`}
              role="status"
            >
              {error || status}
            </p>
          )}
        </div>

        <footer className="section-record-dialog-footer">
          {phase === "idle" && (
            <button
              type="button"
              className="section-record-dialog-record"
              onClick={startRecording}
            >
              <Circle size={14} fill="currentColor" /> Record
            </button>
          )}
          {phase === "recording" && (
            <button
              type="button"
              className="section-record-dialog-record is-recording"
              onClick={stopRecording}
            >
              <Square size={14} fill="currentColor" /> Stop
            </button>
          )}
          {phase === "drag" && take && takeObjectUrl && (
            <>
              <button
                type="button"
                className="section-record-dialog-record is-drag"
                onClick={() => void sendToDragBridge()}
                aria-label="Send to Drag Bridge for Cubase"
              >
                <GripVertical size={15} />{" "}
                {bridgeOnline ? "Drag to Cubase" : "Start Drag Bridge…"}
              </button>
              <a
                className="section-record-dialog-download"
                href={takeObjectUrl}
                download={take.fileName}
                draggable
                onDragStart={onDesktopDragStart}
                aria-label="Drag MIDI to Desktop"
              >
                Desktop
              </a>
              <button
                type="button"
                className="section-record-dialog-download"
                onClick={() => void downloadTake()}
              >
                <Download size={14} /> Download
              </button>
            </>
          )}
          <button
            type="button"
            className="section-record-dialog-cancel"
            onClick={cancelOrClose}
          >
            {phase === "drag" ? "Close" : "Cancel"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
