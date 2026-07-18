"use client"

import {
  Check,
  Download,
  FileText,
  FolderOpen,
  LoaderCircle,
  Play,
  RefreshCw,
  Save,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import { useEffect, useReducer, useRef, useState } from "react"
import {
  initialLyricsWorkspaceState,
  lyricsWorkspaceReducer,
  supportsLyricsWorkspace,
} from "./state"
import type {
  CreativeDirection,
  LyricsAdapters,
  LyricsProject,
  SavedLyrics,
} from "./types"
import "./lyrics.css"

const INITIAL_CREATIVE: CreativeDirection = {
  title: "Midnight Coast",
  about: "Two people leaving the city behind and choosing a new beginning.",
  theme: "Freedom",
  mood: "Intimate",
  avoidWords: "forever, fire",
}

export function LyricsWorkspace({ adapters }: { adapters?: LyricsAdapters }) {
  const adaptersRef = useRef(adapters)
  const client = adaptersRef.current
  const [state, dispatch] = useReducer(
    lyricsWorkspaceReducer,
    initialLyricsWorkspaceState,
  )
  const [supported, setSupported] = useState<boolean | null>(null)
  const [projects, setProjects] = useState<LyricsProject[]>([])
  const [creative, setCreative] = useState(INITIAL_CREATIVE)
  const [message, setMessage] = useState("Choose a melody section to begin.")
  const [error, setError] = useState("")

  const project = projects.find((item) => item.id === state.projectId) ?? null
  const section = project?.sections.find((item) => item.id === state.sectionId) ?? null
  const busy = state.status === "generating" || state.status === "fitting"
  const noteById = new Map(section?.notes.map((note) => [note.id, note]) ?? [])

  const hydrateSaved = (saved: SavedLyrics | undefined) => {
    if (!saved) return false
    setCreative(saved.creative)
    dispatch({
      type: "reopen",
      assignments: saved.assignments,
      recipeReferenceId: saved.recipeReferenceId,
      renderReferenceId: saved.renderReferenceId,
      exportReferenceId: saved.exportReferenceId,
    })
    setMessage(saved.savedLabel)
    return true
  }

  useEffect(() => {
    setSupported(
      supportsLyricsWorkspace(navigator.userAgent, window.innerWidth, Boolean(client)),
    )
  }, [client])

  useEffect(() => {
    if (!client || supported !== true) return
    let cancelled = false
    ;(async () => {
      try {
        const result = await client.projects.list()
        if (cancelled) return
        setProjects(result)
        const first = result[0]
        dispatch({
          type: "select",
          projectId: first?.id ?? "",
          sectionId: first?.sections[0]?.id ?? null,
        })
        if (first?.sections[0]) {
          hydrateSaved(first.savedBySection[first.sections[0].id])
          setMessage(`${first.sections[0].melodyLabel} ready.`)
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Projects could not be loaded.")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [client, supported])

  const chooseProject = async (projectId: string) => {
    if (!client) return
    setError("")
    try {
      const opened = await client.projects.open(projectId)
      setProjects((current) =>
        current.map((item) => (item.id === opened.id ? opened : item)),
      )
      const nextSection = opened.sections[0]
      dispatch({
        type: "select",
        projectId: opened.id,
        sectionId: nextSection?.id ?? null,
      })
      setCreative(INITIAL_CREATIVE)
      if (nextSection && !hydrateSaved(opened.savedBySection[nextSection.id])) {
        setMessage(`${nextSection.melodyLabel} ready.`)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Project could not be opened.")
    }
  }

  const chooseSection = (sectionId: string) => {
    const next = project?.sections.find((item) => item.id === sectionId)
    dispatch({ type: "section", sectionId })
    setCreative(INITIAL_CREATIVE)
    if (!hydrateSaved(project?.savedBySection[sectionId])) {
      setMessage(next ? `${next.melodyLabel} ready.` : "Choose a melody section.")
    }
  }

  const generate = async () => {
    if (!client || !project || !section) return
    dispatch({ type: "generating" })
    setError("")
    setMessage("Generating lyrics for this melody…")
    try {
      const result = await client.lyrics.generate({
        projectId: project.id,
        sectionId: section.id,
        contextRevision: section.contextRevision,
        creative,
        notes: section.notes,
      })
      dispatch({
        type: "generated",
        assignments: result.assignments,
        recipeReferenceId: result.recipeReferenceId,
      })
      setMessage(result.statusLabel)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lyrics could not be generated.")
    }
  }

  const refit = async () => {
    if (!client || !project || !section || !state.recipeReferenceId) return
    dispatch({ type: "fitting" })
    setError("")
    setMessage("Re-fitting edited lyrics…")
    try {
      const result = await client.lyrics.refit({
        projectId: project.id,
        sectionId: section.id,
        contextRevision: section.contextRevision,
        assignments: state.assignments,
        notes: section.notes,
        recipeReferenceId: state.recipeReferenceId,
      })
      dispatch({
        type: "fitted",
        assignments: result.assignments,
        recipeReferenceId: result.recipeReferenceId,
      })
      setMessage(result.statusLabel)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lyrics could not be re-fitted.")
    }
  }

  const audition = async () => {
    if (!client || !project || !section || !state.recipeReferenceId) return
    setError("")
    try {
      const result = await client.lyrics.audition({
        projectId: project.id,
        sectionId: section.id,
        contextRevision: section.contextRevision,
        recipeReferenceId: state.recipeReferenceId,
        assignments: state.assignments,
      })
      dispatch({ type: "auditioned", renderReferenceId: result.renderReferenceId })
      setMessage(result.statusLabel)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Audition could not be prepared.")
    }
  }

  const prepareExport = async () => {
    if (!client || !project || !section || !state.recipeReferenceId) return
    setError("")
    try {
      const result = await client.lyrics.export({
        projectId: project.id,
        sectionId: section.id,
        contextRevision: section.contextRevision,
        recipeReferenceId: state.recipeReferenceId,
        renderReferenceId: state.renderReferenceId,
      })
      dispatch({ type: "exported", exportReferenceId: result.exportReferenceId })
      setMessage(result.statusLabel)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export could not be prepared.")
    }
  }

  const save = async () => {
    if (!client || !project || !section || !state.recipeReferenceId) return
    setError("")
    try {
      const updated = await client.projects.save({
        projectId: project.id,
        sectionId: section.id,
        contextRevision: section.contextRevision,
        creative,
        assignments: state.assignments,
        recipeReferenceId: state.recipeReferenceId,
        renderReferenceId: state.renderReferenceId,
        exportReferenceId: state.exportReferenceId,
      })
      setProjects((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      dispatch({ type: "saved" })
      setMessage(updated.savedBySection[section.id]?.savedLabel ?? "Lyrics saved.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lyrics could not be saved.")
    }
  }

  const reopen = async () => {
    if (!client || !project || !section) return
    setError("")
    try {
      const opened = await client.projects.open(project.id)
      setProjects((current) =>
        current.map((item) => (item.id === opened.id ? opened : item)),
      )
      if (!hydrateSaved(opened.savedBySection[section.id])) {
        setMessage("No saved lyrics exist for this section yet.")
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lyrics could not be reopened.")
    }
  }

  if (supported === null) {
    return <div className="lyrics-check">Checking desktop workspace…</div>
  }

  if (!supported) {
    return (
      <section className="lyrics-stop" role="alert">
        <TriangleAlert size={38} aria-hidden="true" />
        <div>
          <span>Lyrics workspace unavailable</span>
          <h2>{client ? "Open Lyrics on a desktop browser." : "Lyrics service connection required."}</h2>
          <p>
            {client
              ? "This first release is designed for desktop screens at least 1024 pixels wide."
              : "No production lyrics client is configured. Generation, fitting, audition, and export remain disabled."}
          </p>
        </div>
      </section>
    )
  }

  return (
    <div className="lyrics-workspace">
      <section className="lyrics-context" aria-labelledby="lyrics-context-title">
        <div className="lyrics-context-heading">
          <span>Song context</span>
          <h2 id="lyrics-context-title">{project?.title ?? "Choose a project"}</h2>
        </div>
        <label>
          <span>Project</span>
          <select
            aria-label="Project"
            value={state.projectId ?? ""}
            onChange={(event) => void chooseProject(event.target.value)}
          >
            {projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <label>
          <span>Melody section</span>
          <select
            aria-label="Melody section"
            value={state.sectionId ?? ""}
            onChange={(event) => chooseSection(event.target.value)}
          >
            {project?.sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div className="lyrics-context-facts">
          <span><small>Melody</small><strong>{section?.melodyLabel ?? "—"}</strong></span>
          <span><small>Length</small><strong>{section ? `${section.bars} bars` : "—"}</strong></span>
          <span><small>Tempo</small><strong>{project ? `${project.tempo} bpm` : "—"}</strong></span>
          <span><small>Key</small><strong>{project?.key ?? "—"}</strong></span>
        </div>
      </section>

      {error && <div className="lyrics-alert" role="alert"><TriangleAlert size={18} /> {error}</div>}

      <div className="lyrics-layout">
        <aside className="lyrics-card lyrics-direction">
          <header>
            <span>Step 1</span>
            <h3>Creative direction</h3>
            <p>Simple guidance for words that fit this melody.</p>
          </header>
          <label>
            <span>Title</span>
            <input
              aria-label="Title"
              value={creative.title}
              onChange={(event) => setCreative({ ...creative, title: event.target.value })}
            />
          </label>
          <label>
            <span>About</span>
            <textarea
              aria-label="About"
              rows={3}
              value={creative.about}
              onChange={(event) => setCreative({ ...creative, about: event.target.value })}
            />
          </label>
          <div className="lyrics-direction-grid">
            <label>
              <span>Theme</span>
              <select
                aria-label="Theme"
                value={creative.theme}
                onChange={(event) => setCreative({ ...creative, theme: event.target.value })}
              >
                {["Love", "Longing", "Freedom", "Reflection", "Healing", "Confidence"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Mood</span>
              <select
                aria-label="Mood"
                value={creative.mood}
                onChange={(event) => setCreative({ ...creative, mood: event.target.value })}
              >
                {["Intimate", "Uplifting", "Melancholic", "Minimal", "Cinematic"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Avoid</span>
            <input
              aria-label="Avoid words"
              value={creative.avoidWords}
              onChange={(event) => setCreative({ ...creative, avoidWords: event.target.value })}
            />
          </label>
          <button className="lyrics-primary" type="button" disabled={!section || busy} onClick={() => void generate()}>
            {state.status === "generating" ? <LoaderCircle className="lyrics-spin" size={18} /> : <Sparkles size={18} />}
            {state.assignments.length ? "Generate again" : "Generate lyrics"}
          </button>
        </aside>

        <section className="lyrics-card lyrics-editor" aria-labelledby="lyrics-editor-title">
          <header className="lyrics-editor-header">
            <div>
              <span>Step 2</span>
              <h3 id="lyrics-editor-title">Lyrics & note assignment</h3>
              <p>Edit words or syllables, then re-fit them to the melody.</p>
            </div>
            <span className={`lyrics-state is-${state.status}`}>
              {busy && <LoaderCircle className="lyrics-spin" size={14} />}
              {state.status === "saved" ? "Saved" : state.status === "fitting" ? "Re-fitting" : state.assignments.length ? "Editable" : "Waiting"}
            </span>
          </header>

          {state.assignments.length === 0 ? (
            <div className="lyrics-empty">
              <FileText size={30} />
              <strong>Words will appear on the melody here.</strong>
              <p>Generate lyrics to create an editable word, syllable, and note map.</p>
            </div>
          ) : (
            <>
              <div className="lyrics-assignment-head" aria-hidden="true">
                <span>Word</span><span>Syllable</span><span>Assigned note</span>
              </div>
              <div className="lyrics-assignments">
                {state.assignments.map((assignment) => {
                  const note = noteById.get(assignment.noteId)
                  return (
                    <div className="lyrics-assignment" key={assignment.id}>
                      <input
                        aria-label={`Word ${assignment.id}`}
                        value={assignment.word}
                        onChange={(event) => dispatch({ type: "edit", assignmentId: assignment.id, field: "word", value: event.target.value })}
                      />
                      <input
                        aria-label={`Syllable ${assignment.id}`}
                        value={assignment.syllable}
                        onChange={(event) => dispatch({ type: "edit", assignmentId: assignment.id, field: "syllable", value: event.target.value })}
                      />
                      <div className="lyrics-note">
                        <strong>{note?.pitchLabel ?? "—"}</strong>
                        <span>{note?.label} · {note?.beatLabel}</span>
                        <small>{note?.durationLabel}</small>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="lyrics-editor-actions">
                <button type="button" disabled={busy} onClick={() => void refit()}>
                  {state.status === "fitting" ? <LoaderCircle className="lyrics-spin" size={16} /> : <RefreshCw size={16} />}
                  Re-fit after edits
                </button>
                <span>{state.assignments.length} syllables · {section?.notes.length ?? 0} melody notes</span>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="lyrics-card lyrics-delivery" aria-labelledby="lyrics-delivery-title">
        <header>
          <span>Step 3</span>
          <h3 id="lyrics-delivery-title">Audition, export & save</h3>
        </header>
        <div className="lyrics-delivery-status" role="status">
          <span className={`lyrics-status-dot is-${state.status}`} />
          <div>
            <strong>{message}</strong>
            <p>Only display-safe lyrics, note context, and opaque references move through this workspace.</p>
          </div>
        </div>
        <div className="lyrics-delivery-actions">
          <button type="button" disabled={!state.recipeReferenceId} onClick={() => void audition()}>
            <Play size={16} fill="currentColor" /> Audition
          </button>
          <button type="button" disabled={!state.recipeReferenceId} onClick={() => void prepareExport()}>
            <Download size={16} /> Prepare export
          </button>
          <button type="button" disabled={!state.recipeReferenceId || !state.dirty} onClick={() => void save()}>
            <Save size={16} /> Save lyrics
          </button>
          <button type="button" disabled={!project?.savedBySection[state.sectionId ?? ""]} onClick={() => void reopen()}>
            <FolderOpen size={16} /> Reopen saved
          </button>
        </div>
        <div className="lyrics-milestones">
          <span className={state.renderReferenceId ? "is-done" : ""}><Check size={14} /> Audition {state.renderReferenceId ? "ready" : "not prepared"}</span>
          <span className={state.exportReferenceId ? "is-done" : ""}><Check size={14} /> Export {state.exportReferenceId ? "prepared" : "not prepared"}</span>
          <span className={!state.dirty && state.recipeReferenceId ? "is-done" : ""}><Check size={14} /> Project {state.recipeReferenceId && !state.dirty ? "saved" : "not saved"}</span>
        </div>
      </section>
    </div>
  )
}
