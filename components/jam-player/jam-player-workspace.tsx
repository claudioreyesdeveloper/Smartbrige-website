"use client"

import {
  LoaderCircle,
  Play,
  RefreshCw,
  Save,
  Square,
  TriangleAlert,
  Usb,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createProductionJamAdapters } from "./production"
import { prepareAndPlay } from "./prepare-flow"
import { SongTimeline } from "./song-timeline"
import type {
  DispatchPlaybackState,
  DisplayChord,
  JamPlayerAdapters,
  JamProjectRecord,
  JamSong,
  JamSongSummary,
  JamStyleSummary,
  ReharmonizeCandidate,
} from "./types"
import { JamEngineError } from "./types"
import "./jam-player.css"

type JamPlayerWorkspaceProps = {
  adapters?: JamPlayerAdapters
}

const KEY_OPTIONS = [
  "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B",
] as const

const SAVE_LABELS: Record<string, string> = {
  clean: "All changes saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
}

function applyCandidateChords(
  song: JamSong,
  chordsBySection: Record<string, DisplayChord[]> | null | undefined,
): JamSong {
  if (!chordsBySection) return song
  return {
    ...song,
    sections: song.sections.map((section) => ({
      ...section,
      chords: chordsBySection[section.id] ?? section.chords,
    })),
  }
}

function idlePlayback(): DispatchPlaybackState {
  return {
    status: "idle",
    planId: null,
    selection: null,
    positionMs: 0,
    durationMs: 0,
    currentChord: "",
    currentSectionLabel: "",
    error: null,
  }
}

export function JamPlayerWorkspace({ adapters: injected }: JamPlayerWorkspaceProps) {
  const adaptersRef = useRef(injected ?? createProductionJamAdapters())
  const adapters = adaptersRef.current
  const loopGuardRef = useRef(false)

  const [categories, setCategories] = useState<string[]>([])
  const [category, setCategory] = useState("All")
  const [songSearch, setSongSearch] = useState("")
  const [summaries, setSummaries] = useState<JamSongSummary[]>([])
  const [song, setSong] = useState<JamSong | null>(null)
  const [styles, setStyles] = useState<JamStyleSummary[]>([])
  const [styleCategory, setStyleCategory] = useState("All")
  const [styleSearch, setStyleSearch] = useState("")
  const [styleId, setStyleId] = useState("")
  const [key, setKey] = useState("C")
  const [tempo, setTempo] = useState(112)
  const [loop, setLoop] = useState(false)

  const [projects, setProjects] = useState<JamProjectRecord[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectTitle, setProjectTitle] = useState("")
  const [saveState, setSaveState] = useState(adapters.projects.getSaveState())
  const [saveError, setSaveError] = useState<string | null>(null)

  const [connection, setConnection] = useState(adapters.connection.getState())
  const [playback, setPlayback] = useState<DispatchPlaybackState>(idlePlayback())

  const [candidates, setCandidates] = useState<ReharmonizeCandidate[]>([])
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [candidateId, setCandidateId] = useState<string | null>(null)
  const [chordsBySection, setChordsBySection] = useState<Record<
    string,
    DisplayChord[]
  > | null>(null)

  const [planFingerprint, setPlanFingerprint] = useState<string | null>(null)

  const [loadingSongs, setLoadingSongs] = useState(true)
  const [loadingSong, setLoadingSong] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [reharmonizing, setReharmonizing] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [quotaMessage, setQuotaMessage] = useState("")

  const displaySong = useMemo(
    () => (song ? applyCandidateChords(song, chordsBySection) : null),
    [song, chordsBySection],
  )

  const fingerprint = useMemo(() => {
    if (!song) return ""
    return JSON.stringify({
      songId: song.id,
      key,
      tempo,
      styleId,
      loop,
      candidateId,
      generationId,
    })
  }, [song, key, tempo, styleId, loop, candidateId, generationId])

  const planMatchesRequest = Boolean(
    planFingerprint &&
      planFingerprint === fingerprint &&
      adapters.dispatcher.getState().planId,
  )

  const selectedStyle =
    styles.find((style) => style.id === styleId) ??
    styles.find((style) => style.name === "EasyPop") ??
    styles[0]

  const styleCategories = useMemo(
    () => ["All", ...Array.from(new Set(styles.map((s) => s.category))).sort()],
    [styles],
  )

  const filteredStyles = useMemo(() => {
    const q = styleSearch.trim().toLowerCase()
    return styles.filter(
      (style) =>
        (styleCategory === "All" || style.category === styleCategory) &&
        (!q ||
          style.name.toLowerCase().includes(q) ||
          style.category.toLowerCase().includes(q)),
    )
  }, [styles, styleCategory, styleSearch])

  const markDirty = useCallback(() => {
    adapters.projects.markDirty()
    setSaveState(adapters.projects.getSaveState())
    setPlanFingerprint(null)
  }, [adapters.projects])

  const ensureOwnedProject = useCallback(async (): Promise<string> => {
    if (projectId) return projectId
    if (!displaySong) throw new Error("Load a song before creating a project.")

    const created = await adapters.projects.create(
      projectTitle || displaySong.title || "Jam Project",
    )
    const saved = await adapters.projects.save({
      ...created,
      title: projectTitle || displaySong.title,
      songId: displaySong.id,
      key,
      tempo,
      styleId,
      model: connection.model ?? "genos",
      loop,
      generationId,
      candidateId,
      chordsBySection,
      song: displaySong,
    })
    setProjectId(saved.id)
    setProjectTitle(saved.title)
    setProjects(await adapters.projects.list())
    return saved.id
  }, [
    adapters.projects,
    candidateId,
    chordsBySection,
    connection.model,
    displaySong,
    generationId,
    key,
    loop,
    projectId,
    projectTitle,
    styleId,
    tempo,
  ])

  useEffect(() => adapters.connection.subscribe(setConnection), [adapters.connection])
  useEffect(() => adapters.dispatcher.subscribe(setPlayback), [adapters.dispatcher])
  useEffect(
    () =>
      adapters.projects.subscribe(() => {
        setSaveState(adapters.projects.getSaveState())
        setSaveError(adapters.projects.getLastError())
      }),
    [adapters.projects],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingSongs(true)
      setErrorMessage("")
      try {
        const [cats, list, projectList] = await Promise.all([
          adapters.catalog.listCategories(),
          adapters.catalog.listSongs(),
          adapters.projects.list(),
        ])
        if (cancelled) return
        setCategories(["All", ...cats])
        setSummaries(list)
        setProjects(projectList)
        if (list[0]) {
          setLoadingSong(true)
          const first = await adapters.catalog.getSong(list[0].id)
          if (cancelled) return
          setSong(first)
          setKey(first.key)
          setTempo(first.tempo)
          setProjectTitle(first.title)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load songs.",
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingSongs(false)
          setLoadingSong(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [adapters.catalog, adapters.projects])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const model = connection.model ?? "genos"
      const list = await adapters.catalog.listStyles({ model })
      if (cancelled) return
      setStyles(list)
      setStyleId((current) => {
        if (current && list.some((style) => style.id === current)) return current
        const easy = list.find((s) => s.name === "EasyPop") ?? list[0]
        if (easy) setStyleSearch(easy.name)
        return easy?.id ?? ""
      })
    })()
    return () => {
      cancelled = true
    }
  }, [adapters.catalog, connection.model])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await adapters.catalog.listSongs({
        category: category === "All" ? undefined : category,
        search: songSearch,
      })
      if (!cancelled) setSummaries(list)
    })()
    return () => {
      cancelled = true
    }
  }, [adapters.catalog, category, songSearch])

  const playArrangement = useCallback(
    async (mode: "full" | "section", sectionId?: string) => {
      setErrorMessage("")
      setQuotaMessage("")
      if (!connection.browserSupported || !connection.connected || !connection.model) {
        setErrorMessage(connection.guidance)
        return
      }
      if (!displaySong || !styleId) {
        setErrorMessage("Load a song and choose a style before playing.")
        return
      }
      if (!selectedStyle) {
        setErrorMessage("Choose a Yamaha style before playing.")
        return
      }

      let ownedProjectId: string
      try {
        ownedProjectId = await ensureOwnedProject()
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Create a project before playing.",
        )
        return
      }

      const request = {
        projectId: ownedProjectId,
        model: connection.model,
        song: displaySong,
        key,
        tempo,
        styleId,
        styleNumber: selectedStyle.styleNumber,
        loop,
        candidateId,
        generationId,
      }
      const selection =
        mode === "section" && sectionId
          ? ({ mode: "section" as const, sectionId })
          : ({ mode: "full" as const })

      setPreparing(true)
      setStatusMessage(
        planMatchesRequest
          ? "Starting prepared arrangement…"
          : "Preparing arrangement…",
      )

      const result = await prepareAndPlay({
        engine: adapters.engine,
        dispatcher: adapters.dispatcher,
        request,
        selection,
        existingPlan: null,
        planMatchesRequest,
      })

      setPreparing(false)

      if (!result.ok) {
        if (result.code === "quota_exceeded") setQuotaMessage(result.message)
        else setErrorMessage(result.message)
        setStatusMessage("")
        return
      }

      setPlanFingerprint(fingerprint)
      loopGuardRef.current = false
      setStatusMessage(
        mode === "section" && sectionId
          ? `Playing ${displaySong.sections.find((s) => s.id === sectionId)?.label ?? "section"}.`
          : "Playing full arrangement.",
      )
    },
    [
      adapters.dispatcher,
      adapters.engine,
      candidateId,
      connection,
      displaySong,
      fingerprint,
      generationId,
      ensureOwnedProject,
      key,
      loop,
      planMatchesRequest,
      selectedStyle,
      styleId,
      tempo,
    ],
  )

  useEffect(() => {
    if (!loop || playback.status !== "completed") return
    if (playback.selection?.mode !== "full") return
    if (loopGuardRef.current) return
    loopGuardRef.current = true
    void playArrangement("full")
  }, [playback.status, playback.selection, loop, playArrangement])

  const loadSong = async (songId: string) => {
    adapters.dispatcher.stop()
    setLoadingSong(true)
    setErrorMessage("")
    setQuotaMessage("")
    setCandidates([])
    setCandidateId(null)
    setGenerationId(null)
    setChordsBySection(null)
    setPlanFingerprint(null)
    setStatusMessage("")
    try {
      const next = await adapters.catalog.getSong(songId)
      setSong(next)
      setKey(next.key)
      setTempo(next.tempo)
      if (!projectId) setProjectTitle(next.title)
      markDirty()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load song.")
    } finally {
      setLoadingSong(false)
    }
  }

  const stopPlayback = () => {
    adapters.dispatcher.stop()
    loopGuardRef.current = true
    setStatusMessage("Stopped.")
  }

  const runReharmonize = async () => {
    if (!displaySong || !connection.model) {
      setErrorMessage("Load a song and connect a keyboard before reharmonizing.")
      return
    }
    let ownedProjectId: string
    try {
      ownedProjectId = await ensureOwnedProject()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Create a project before reharmonizing.",
      )
      return
    }
    setReharmonizing(true)
    setErrorMessage("")
    setQuotaMessage("")
    setStatusMessage("Requesting chord candidates…")
    try {
      const response = await adapters.engine.reharmonize({
        projectId: ownedProjectId,
        model: connection.model,
        song: displaySong,
        key,
        scope: "song",
      })
      setGenerationId(response.generationId)
      setCandidates(response.candidates)
      setStatusMessage("Choose a candidate to hear different chords.")
      markDirty()
    } catch (error) {
      if (error instanceof JamEngineError && error.code === "quota_exceeded") {
        setQuotaMessage(error.message)
      } else {
        setErrorMessage(
          error instanceof Error ? error.message : "Reharmonization failed.",
        )
      }
      setStatusMessage("")
    } finally {
      setReharmonizing(false)
    }
  }

  const selectCandidate = (id: string | null) => {
    setCandidateId(id)
    if (!id) {
      setChordsBySection(null)
      setStatusMessage("Original chords restored.")
    } else {
      const found = candidates.find((item) => item.id === id)
      setChordsBySection(found?.chordsBySection ?? null)
      setStatusMessage(found ? `${found.label} chords selected.` : "Candidate selected.")
    }
    markDirty()
  }

  const saveProject = async () => {
    if (!song) return
    setErrorMessage("")
    try {
      let record: JamProjectRecord
      if (projectId) {
        record = await adapters.projects.save({
          id: projectId,
          title: projectTitle || song.title,
          version: projects.find((p) => p.id === projectId)?.version ?? 1,
          songId: song.id,
          key,
          tempo,
          styleId,
          model: connection.model ?? "genos",
          loop,
          generationId,
          candidateId,
          chordsBySection,
          song: displaySong,
        })
      } else {
        const created = await adapters.projects.create(projectTitle || song.title)
        record = await adapters.projects.save({
          ...created,
          songId: song.id,
          key,
          tempo,
          styleId,
          model: connection.model ?? "genos",
          loop,
          generationId,
          candidateId,
          chordsBySection,
          song: displaySong,
        })
        setProjectId(record.id)
      }
      setProjects(await adapters.projects.list())
      setProjectTitle(record.title)
      setStatusMessage("Project saved. You can reopen it anytime.")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Save failed.")
    }
  }

  const openProject = async (id: string) => {
    adapters.dispatcher.stop()
    setLoadingSong(true)
    setErrorMessage("")
    try {
      const record = await adapters.projects.open(id)
      const next = await adapters.catalog.getSong(record.songId)
      setProjectId(record.id)
      setProjectTitle(record.title)
      setSong(next)
      setKey(record.key)
      setTempo(record.tempo)
      setStyleId(record.styleId)
      const style = styles.find((item) => item.id === record.styleId)
      if (style) setStyleSearch(style.name)
      setLoop(record.loop)
      setGenerationId(record.generationId)
      setCandidateId(record.candidateId)
      setChordsBySection(record.chordsBySection)
      setCandidates([])
      setPlanFingerprint(null)
      setStatusMessage(`Reopened “${record.title}”.`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not open project.")
    } finally {
      setLoadingSong(false)
    }
  }

  const createProject = async () => {
    const created = await adapters.projects.create(
      projectTitle || song?.title || "Jam Project",
    )
    setProjectId(created.id)
    setProjectTitle(created.title)
    setProjects(await adapters.projects.list())
    markDirty()
    setStatusMessage("New project created. Save when you are ready.")
  }

  const busy = preparing || reharmonizing || loadingSong
  const playing = playback.status === "playing"

  return (
    <div
      className={`paid-jam app-shell-workspace${connection.browserSupported ? "" : " is-unsupported"}`}
    >
      <p className="paid-jam-lead">
        Choose a song, connect your Yamaha, shape the arrangement, then play from the
        timeline.
      </p>

      {!connection.browserSupported && (
        <div className="paid-jam-banner paid-jam-banner-warning" role="alert">
          <TriangleAlert size={22} aria-hidden="true" />
          <div>
            <strong>Use Chrome or Edge on a computer</strong>
            <p>
              SmartBridge Jam requires desktop Chrome or Microsoft Edge. Phones,
              tablets, Safari, and Firefox are not supported.
            </p>
          </div>
        </div>
      )}

      {quotaMessage && (
        <div className="paid-jam-banner paid-jam-banner-quota" role="alert">
          <TriangleAlert size={22} aria-hidden="true" />
          <div>
            <strong>Quota reached</strong>
            <p>{quotaMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="paid-jam-banner paid-jam-banner-error" role="alert">
          <TriangleAlert size={22} aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}

      <div className="paid-jam-layout">
        <aside className="paid-jam-library" aria-label="Songs and projects">
          <div className="paid-jam-panel-heading">
            <span>Song library</span>
            <strong>Factory songs</strong>
          </div>

          <label className="paid-jam-field">
            <span>Find a song</span>
            <input
              type="search"
              value={songSearch}
              onChange={(event) => setSongSearch(event.target.value)}
              placeholder="Type a title"
              aria-label="Find a song"
            />
          </label>

          <div className="paid-jam-category-tabs" role="tablist" aria-label="Song categories">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={item === category}
                className={item === category ? "is-active" : ""}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="paid-jam-song-list">
            {loadingSongs ? (
              <p className="paid-jam-muted">
                <LoaderCircle className="paid-jam-spin" size={18} aria-hidden="true" />
                Loading songs…
              </p>
            ) : summaries.length === 0 ? (
              <p className="paid-jam-muted">No songs match your search.</p>
            ) : (
              summaries.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === song?.id ? "is-active" : ""}
                  onClick={() => void loadSong(item.id)}
                  disabled={busy}
                >
                  <i style={{ background: item.accent }} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.key} · {item.tempo} BPM · {item.sectionCount} sections
                    </small>
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="paid-jam-panel-heading paid-jam-panel-heading-tight">
            <span>Your projects</span>
            <strong>Save & reopen</strong>
          </div>
          <div className="paid-jam-project-actions">
            <button type="button" onClick={() => void createProject()} disabled={busy}>
              New project
            </button>
            <button type="button" onClick={() => void saveProject()} disabled={busy || !song}>
              <Save size={16} aria-hidden="true" /> Save
            </button>
          </div>
          <p className="paid-jam-save-status" role="status" data-state={saveState}>
            {SAVE_LABELS[saveState] ?? saveState}
            {saveError ? ` — ${saveError}` : ""}
          </p>
          <ul className="paid-jam-project-list">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className={project.id === projectId ? "is-active" : ""}
                  onClick={() => void openProject(project.id)}
                  disabled={busy}
                >
                  <strong>{project.title}</strong>
                  <small>v{project.version}</small>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="paid-jam-stage">
          <header className="paid-jam-song-header">
            <div>
              <span className="paid-jam-eyebrow">
                {song?.category ?? "Song"} · Exact source sections
              </span>
              <h2>{loadingSong ? "Loading…" : song?.title ?? "Choose a song"}</h2>
              <p>{song?.subtitle ?? "Pick a factory song from the library."}</p>
            </div>
            <div className="paid-jam-facts" aria-label="Song facts">
              <span>
                <small>Tempo</small>
                <strong>{tempo}</strong>
              </span>
              <span>
                <small>Key</small>
                <strong>{key}</strong>
              </span>
              <span>
                <small>Meter</small>
                <strong>
                  {song ? `${song.timeSignature[0]}/${song.timeSignature[1]}` : "—"}
                </strong>
              </span>
            </div>
          </header>

          <div
            className={`paid-jam-connection${connection.connected ? " is-connected" : ""}`}
            role="status"
            aria-label="Keyboard connection"
          >
            <Usb size={20} aria-hidden="true" />
            <div>
              <span className="paid-jam-step-label">1 · Keyboard connection</span>
              <strong>
                {connection.connected
                  ? connection.displayName
                  : "Keyboard not connected"}
              </strong>
              <p>{connection.guidance}</p>
            </div>
            <button
              type="button"
              onClick={() => void adapters.connection.refresh()}
              disabled={preparing}
            >
              <RefreshCw size={16} aria-hidden="true" /> Refresh connection
            </button>
          </div>

          <section
            className="paid-jam-transform-panel"
            aria-labelledby="paid-jam-transform-title"
          >
            <div className="paid-jam-workflow-heading">
              <span>2 · Shape the arrangement</span>
              <div>
                <h3 id="paid-jam-transform-title">Choose the musical feel</h3>
                <p>Keep the song structure and hear it with a Yamaha factory style.</p>
              </div>
            </div>
            <div className="paid-jam-controls" aria-label="Arrangement controls">
            <label className="paid-jam-field">
              <span>Key</span>
              <select
                value={key}
                aria-label="Key"
                onChange={(event) => {
                  setKey(event.target.value)
                  markDirty()
                }}
              >
                {KEY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="paid-jam-field">
              <span>Tempo</span>
              <input
                type="number"
                min={40}
                max={300}
                value={tempo}
                aria-label="Tempo"
                onChange={(event) => {
                  setTempo(Number(event.target.value) || tempo)
                  markDirty()
                }}
              />
            </label>

            <label className="paid-jam-field paid-jam-field-grow">
              <span>Style search</span>
              <input
                type="search"
                list="paid-jam-style-suggestions"
                value={styleSearch}
                placeholder={`Search ${styles.length} styles`}
                aria-label="Search styles"
                autoComplete="off"
                onChange={(event) => {
                  const value = event.target.value
                  setStyleSearch(value)
                  const exact = styles.find(
                    (style) =>
                      style.name.toLowerCase() === value.trim().toLowerCase(),
                  )
                  if (exact) {
                    setStyleId(exact.id)
                    markDirty()
                  }
                }}
              />
              <datalist id="paid-jam-style-suggestions">
                {filteredStyles.map((style) => (
                  <option key={style.id} value={style.name}>
                    {style.category}
                  </option>
                ))}
              </datalist>
            </label>

            <label className="paid-jam-field">
              <span>Style category</span>
              <select
                value={styleCategory}
                aria-label="Style category"
                onChange={(event) => setStyleCategory(event.target.value)}
              >
                {styleCategories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="paid-jam-field paid-jam-field-grow">
              <span>Yamaha style</span>
              <select
                value={selectedStyle?.id ?? ""}
                aria-label="Yamaha style"
                onChange={(event) => {
                  setStyleId(event.target.value)
                  const next = styles.find((s) => s.id === event.target.value)
                  if (next) setStyleSearch(next.name)
                  markDirty()
                }}
              >
                <option value="" disabled>
                  {filteredStyles.length ? "Choose a style" : "No matching styles"}
                </option>
                {filteredStyles.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                    {style.bpm ? ` · ${style.bpm} BPM` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="paid-jam-loop">
              <input
                type="checkbox"
                checked={loop}
                aria-label="Loop full song"
                onChange={(event) => {
                  setLoop(event.target.checked)
                  markDirty()
                }}
              />
              <span>Loop full song</span>
            </label>
            </div>
          </section>

          <section
            className={`paid-jam-performance-panel${playing ? " is-playing" : ""}`}
            aria-labelledby="paid-jam-performance-title"
          >
            <div className="paid-jam-workflow-heading">
              <span>3 · Play</span>
              <div>
                <h3 id="paid-jam-performance-title">Play the full song or one section</h3>
                <p>Double-click a section below, or focus it and press Enter.</p>
              </div>
            </div>
            <div className="paid-jam-transport">
            <button
              className="paid-jam-transport-main"
              type="button"
              onClick={() => {
                if (playing) stopPlayback()
                else void playArrangement("full")
              }}
              disabled={busy && !playing}
            >
              {preparing ? (
                <LoaderCircle className="paid-jam-spin" size={22} aria-hidden="true" />
              ) : playing ? (
                <Square size={22} fill="currentColor" aria-hidden="true" />
              ) : (
                <Play size={22} fill="currentColor" aria-hidden="true" />
              )}
              {preparing ? "Preparing…" : playing ? "Stop" : "Play arrangement"}
            </button>
            <div className="paid-jam-readout" aria-live="polite">
              <span>
                <small>Now</small>
                <strong>{playback.currentChord || "—"}</strong>
              </span>
              <span>
                <small>Section</small>
                <strong>{playback.currentSectionLabel || "—"}</strong>
              </span>
              <span>
                <small>Plan</small>
                <strong>{planMatchesRequest ? "Ready" : "Needs prepare"}</strong>
              </span>
            </div>
            </div>
          </section>

          <div className="paid-jam-reharm">
            <div>
              <span className="paid-jam-eyebrow">Optional musical variation</span>
              <strong>Would you like to hear another chord color?</strong>
              <p>Ask for a few safe choices, then compare them with the original chords.</p>
            </div>
            <button
              type="button"
              onClick={() => void runReharmonize()}
              disabled={busy || !song}
            >
              {reharmonizing ? "Finding choices…" : "Suggest chord choices"}
            </button>
            <label className="paid-jam-field">
              <span>Chord choice</span>
              <select
                value={candidateId ?? ""}
                aria-label="Reharmonization candidate"
                onChange={(event) =>
                  selectCandidate(event.target.value ? event.target.value : null)
                }
                disabled={!candidates.length && !candidateId}
              >
                <option value="">Original chords</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="paid-jam-field paid-jam-project-title">
            <span>Project name</span>
            <input
              type="text"
              value={projectTitle}
              aria-label="Project name"
              onChange={(event) => {
                setProjectTitle(event.target.value)
                markDirty()
              }}
            />
          </label>

          {statusMessage && (
            <div className="paid-jam-status" role="status">
              {statusMessage}
            </div>
          )}

          {displaySong ? (
            <SongTimeline
              song={{ ...displaySong, tempo, key }}
              playback={playback}
              disabled={busy && !playing}
              onPlaySection={(sectionId) => void playArrangement("section", sectionId)}
            />
          ) : (
            <p className="paid-jam-muted">Select a song to see its section timeline.</p>
          )}

          <p className="paid-jam-hint">
            Tip: double-click any section (or press Enter when focused) to play just that
            section. Playback always uses a prepared plan.
          </p>
        </section>
      </div>
    </div>
  )
}
