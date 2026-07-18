"use client"

import {
  CheckCircle2,
  Disc3,
  LoaderCircle,
  Music2,
  Play,
  RefreshCw,
  Square,
  TriangleAlert,
} from "lucide-react"
import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import { createProductionBassDrumsAdapters } from "./production"
import {
  initialRhythmWorkspaceState,
  rhythmWorkspaceReducer,
  supportsRhythmWorkspace,
} from "./state"
import {
  RhythmAdapterError,
  type BassDrumsAdapters,
  type RhythmCandidateSummary,
  type RhythmFillSummary,
  type RhythmFilterOptions,
  type RhythmFilters,
  type RhythmPart,
  type RhythmProject,
} from "./types"
import "./bass-drums.css"

const DEFAULT_FILTERS: RhythmFilters = {
  genre: "All Genres",
  section: "All Sections",
  feel: "All Feels",
}

const EMPTY_OPTIONS: RhythmFilterOptions = {
  genres: ["All Genres"],
  sections: ["All Sections"],
  feels: ["All Feels"],
}

type BassDrumsWorkspaceProps = {
  adapters?: BassDrumsAdapters
  /** Initial Bass / Drums tab (defaults to bass). */
  initialTab?: RhythmPart
  /**
   * `local` — in-panel tab buttons (legacy).
   * `route` — Jam Player sub-routes own the tab; clicking switches URL.
   */
  partTabs?: "local" | "route"
}

export function BassDrumsWorkspace({
  adapters: injected,
  initialTab = "bass",
  partTabs = "local",
}: BassDrumsWorkspaceProps) {
  const adaptersRef = useRef(injected ?? createProductionBassDrumsAdapters())
  const adapters = adaptersRef.current
  const [state, dispatch] = useReducer(rhythmWorkspaceReducer, initialTab, (tab) => ({
    ...initialRhythmWorkspaceState,
    activeTab: tab,
  }))
  const [supported, setSupported] = useState<boolean | null>(null)
  const [projects, setProjects] = useState<RhythmProject[]>([])
  const [filters, setFilters] = useState<Record<RhythmPart, RhythmFilters>>({
    bass: { ...DEFAULT_FILTERS },
    drums: { ...DEFAULT_FILTERS },
  })
  const [filterOptions, setFilterOptions] = useState<
    Record<RhythmPart, RhythmFilterOptions>
  >({
    bass: EMPTY_OPTIONS,
    drums: EMPTY_OPTIONS,
  })
  const [candidates, setCandidates] = useState<RhythmCandidateSummary[]>([])
  const [resultCount, setResultCount] = useState(0)
  const [fills, setFills] = useState<RhythmFillSummary[]>([])
  const [contextStatus, setContextStatus] = useState("Loading section context…")
  const [error, setError] = useState("")
  const [quota, setQuota] = useState("")
  const [applying, setApplying] = useState(false)

  const project = projects.find((item) => item.id === state.projectId) ?? null
  const section =
    project?.sections.find((item) => item.id === state.sectionId) ?? null
  const selectedCandidate =
    candidates.find((item) =>
      state.activeTab === "bass"
        ? item.id === state.bassCandidateId
        : item.id === state.drumCandidateId,
    ) ?? null
  const selectedFill = fills.find((item) => item.id === state.fillCandidateId) ?? null

  const slots = useMemo(() => {
    if (!section) return []
    return Array.from({ length: Math.floor(section.bars / 4) }, (_, index) => ({
      index,
      bar: (index + 1) * 4,
    }))
  }, [section])

  useEffect(() => {
    setSupported(
      supportsRhythmWorkspace(navigator.userAgent, window.isSecureContext),
    )
  }, [])

  useEffect(() => adapters.audition.subscribe((next) => dispatch({
    type: "audition",
    state: next,
  })), [adapters.audition])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const projectList = await adapters.projects.list()
        if (cancelled) return
        setProjects(projectList)
        const first = projectList[0]
        if (first) {
          const [bassOptions, drumOptions] = await Promise.all([
            adapters.library.getFilterOptions("bass", first.id),
            adapters.library.getFilterOptions("drums", first.id),
          ])
          if (cancelled) return
          setFilterOptions({ bass: bassOptions, drums: drumOptions })
          dispatch({
            type: "select-project",
            projectId: first.id,
            sectionId: first.sections[0]?.id ?? null,
          })
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
  }, [adapters.library, adapters.projects])

  useEffect(() => {
    if (!project || !section) return
    let cancelled = false
    ;(async () => {
      setError("")
      setQuota("")
      setContextStatus(`Refreshing for ${section.name} chord context…`)
      try {
        const currentFilters = filters[state.activeTab]
        const result =
          state.activeTab === "drums" &&
          state.suggestedDrums &&
          state.bassCandidateId
            ? await adapters.library.getSuggestedDrums({
                projectId: project.id,
                sectionId: section.id,
                contextRevision: section.contextRevision,
                filters: currentFilters,
                bassCandidateId: state.bassCandidateId,
              })
            : await adapters.library.queryCandidates({
                projectId: project.id,
                sectionId: section.id,
                contextRevision: section.contextRevision,
                part: state.activeTab,
                filters: currentFilters,
              })
        if (cancelled) return
        setCandidates(result.candidates)
        setResultCount(result.total)
        setContextStatus(result.contextLabel)
        dispatch({ type: "context-loaded" })
      } catch (cause) {
        if (cancelled) return
        const message =
          cause instanceof Error ? cause.message : "Candidates could not be loaded."
        if (cause instanceof RhythmAdapterError && cause.code === "quota_exceeded") {
          setQuota(message)
        } else {
          setError(message)
        }
        setCandidates([])
        setResultCount(0)
        dispatch({ type: "context-loaded" })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    adapters.library,
    filters,
    project,
    section,
    state.activeTab,
    state.bassCandidateId,
    state.suggestedDrums,
  ])

  useEffect(() => {
    if (!project || !section || !state.drumCandidateId) {
      setFills([])
      return
    }
    const drumCandidateId = state.drumCandidateId
    let cancelled = false
    ;(async () => {
      try {
        const next = await adapters.library.getFills({
          projectId: project.id,
          sectionId: section.id,
          contextRevision: section.contextRevision,
          drumCandidateId,
        })
        if (!cancelled) setFills(next)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Fills could not be loaded.")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [adapters.library, project, section, state.drumCandidateId])

  const selectProject = async (projectId: string) => {
    adapters.audition.stop()
    setError("")
    try {
      const [opened, bassOptions, drumOptions] = await Promise.all([
        adapters.projects.open(projectId),
        adapters.library.getFilterOptions("bass", projectId),
        adapters.library.getFilterOptions("drums", projectId),
      ])
      setProjects((current) =>
        current.map((item) => (item.id === opened.id ? opened : item)),
      )
      setFilterOptions({ bass: bassOptions, drums: drumOptions })
      dispatch({
        type: "select-project",
        projectId: opened.id,
        sectionId: opened.sections[0]?.id ?? null,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Project could not be opened.")
    }
  }

  const updateFilter = (name: keyof RhythmFilters, value: string) => {
    if (state.suggestedDrums) dispatch({ type: "clear-suggested" })
    setFilters((current) => ({
      ...current,
      [state.activeTab]: { ...current[state.activeTab], [name]: value },
    }))
  }

  const audition = async (
    candidate: RhythmCandidateSummary | RhythmFillSummary,
  ) => {
    if (!project || !section) return
    setError("")
    try {
      const render = await adapters.library.prepareAudition({
        projectId: project.id,
        sectionId: section.id,
        contextRevision: section.contextRevision,
        source: candidate.audition,
      })
      await adapters.audition.play(render, candidate.name)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Audition could not start.")
    }
  }

  const applyToSong = async () => {
    if (!project || !section) return
    setApplying(true)
    setError("")
    setQuota("")
    try {
      const result = await adapters.library.applyToSong({
        projectId: project.id,
        sectionId: section.id,
        contextRevision: section.contextRevision,
        bassCandidateId: state.bassCandidateId,
        drumCandidateId: state.drumCandidateId,
        fillCandidateIdsBySlot: state.fillSlots,
      })
      setProjects((current) =>
        current.map((item) => (item.id === result.project.id ? result.project : item)),
      )
      dispatch({ type: "applied", summary: result.message })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Apply to Song failed."
      if (cause instanceof RhythmAdapterError && cause.code === "quota_exceeded") {
        setQuota(message)
      } else {
        setError(message)
      }
    } finally {
      setApplying(false)
    }
  }

  if (supported === null) {
    return <div className="rhythm-compatibility-check">Checking browser compatibility…</div>
  }

  if (!supported) {
    return (
      <section className="rhythm-compatibility-stop" role="alert">
        <TriangleAlert size={38} aria-hidden="true" />
        <div>
          <span>Desktop workspace required</span>
          <h2>Open Bass & Drums in Chrome or Microsoft Edge on a computer.</h2>
          <p>
            Phones, tablets, Safari, and Firefox are not supported for this
            Yamaha-connected workspace.
          </p>
        </div>
      </section>
    )
  }

  const activeFilters = filters[state.activeTab]
  const activeOptions = filterOptions[state.activeTab]
  const canApply = Boolean(state.bassCandidateId || state.drumCandidateId)

  return (
    <div className="rhythm-workspace app-shell-workspace">
      <section className="rhythm-context" aria-labelledby="rhythm-context-title">
        <div className="rhythm-context-heading">
          <span>Song context</span>
          <h2 id="rhythm-context-title">{project?.title ?? "Choose a project"}</h2>
        </div>
        <label>
          <span>Project</span>
          <select
            aria-label="Project"
            value={state.projectId ?? ""}
            onChange={(event) => void selectProject(event.target.value)}
          >
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Song section</span>
          <select
            aria-label="Song section"
            value={state.sectionId ?? ""}
            onChange={(event) => {
              adapters.audition.stop()
              dispatch({ type: "select-section", sectionId: event.target.value })
            }}
          >
            {project?.sections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="rhythm-context-facts">
          <span><small>Section</small><strong>{section?.name ?? "—"}</strong></span>
          <span><small>Length</small><strong>{section ? `${section.bars} bars` : "—"}</strong></span>
          <span><small>Tempo</small><strong>{project ? `${project.tempo} bpm` : "—"}</strong></span>
          <span><small>Key</small><strong>{project?.key ?? "—"}</strong></span>
        </div>
        <div className="rhythm-chords">
          <small>Chord context</small>
          <strong>{section?.chordContext ?? "—"}</strong>
          <span role="status">
            {state.loadingContext ? (
              <><LoaderCircle className="rhythm-spin" size={14} aria-hidden="true" /> {contextStatus}</>
            ) : (
              <><RefreshCw size={14} aria-hidden="true" /> {contextStatus}</>
            )}
          </span>
        </div>
      </section>

      {quota && <div className="rhythm-alert is-quota" role="alert"><TriangleAlert size={18} /> <strong>Quota reached:</strong> {quota}</div>}
      {error && <div className="rhythm-alert" role="alert"><TriangleAlert size={18} /> {error}</div>}

      {partTabs === "local" ? (
        <div className="rhythm-tabs" role="tablist" aria-label="Performance type">
          {(["bass", "drums"] as const).map((part) => (
            <button
              key={part}
              type="button"
              role="tab"
              aria-selected={state.activeTab === part}
              className={state.activeTab === part ? "is-active" : ""}
              onClick={() => {
                adapters.audition.stop()
                dispatch({ type: "select-tab", tab: part })
              }}
            >
              {part === "bass" ? <Music2 size={17} /> : <Disc3 size={17} />}
              {part === "bass" ? "Bass Performance" : "Drum Performance"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="rhythm-panel-grid">
        <section className="rhythm-card rhythm-library-card">
          <header className="rhythm-card-title">
            <div>
              <span>{state.activeTab === "bass" ? "Bass" : "Drums"}</span>
              <h3>{state.activeTab === "bass" ? "Bass phrases" : "Drum grooves"}</h3>
            </div>
            <strong>{resultCount} {resultCount === 1 ? "result" : "results"}</strong>
          </header>

          <div className="rhythm-filters" aria-label={`${state.activeTab} filters`}>
            {([
              ["genre", "Genre", activeOptions.genres],
              ["section", "Section", activeOptions.sections],
              ["feel", "Feel", activeOptions.feels],
            ] as const).map(([name, label, options]) => (
              <label key={name}>
                <span>{label}</span>
                <select
                  aria-label={label}
                  value={activeFilters[name]}
                  onChange={(event) => updateFilter(name, event.target.value)}
                >
                  {options.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            ))}
            {state.activeTab === "drums" && (
              <button
                type="button"
                className={`rhythm-suggested${state.suggestedDrums ? " is-active" : ""}`}
                disabled={!state.bassCandidateId || state.loadingContext}
                onClick={() => dispatch({ type: "show-suggested" })}
              >
                Suggested drums
              </button>
            )}
          </div>

          <div className="rhythm-results" role="listbox" aria-label={`${state.activeTab === "bass" ? "Bass phrase" : "Drum groove"} candidates`}>
            {state.loadingContext ? (
              <p className="rhythm-empty"><LoaderCircle className="rhythm-spin" size={18} /> Re-querying for this chord context…</p>
            ) : candidates.length === 0 ? (
              <p className="rhythm-empty">No candidates match these filters.</p>
            ) : candidates.map((candidate) => {
              const selected =
                candidate.id === (state.activeTab === "bass"
                  ? state.bassCandidateId
                  : state.drumCandidateId)
              return (
                <button
                  key={candidate.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? "is-selected" : ""}
                  onClick={() => dispatch({
                    type: state.activeTab === "bass" ? "select-bass" : "select-drums",
                    candidateId: candidate.id,
                  })}
                  onDoubleClick={() => void audition(candidate)}
                >
                  <span className="rhythm-row-icon">{state.activeTab === "bass" ? "B" : "D"}</span>
                  <span>
                    <strong>{candidate.name}</strong>
                    <small>{candidate.genre} · {candidate.section} · {candidate.feel}</small>
                    <em>{candidate.summary}</em>
                  </span>
                  <b>{candidate.bars} bars</b>
                </button>
              )
            })}
          </div>

          <div className="rhythm-actions">
            <button type="button" disabled={!selectedCandidate} onClick={() => selectedCandidate && void audition(selectedCandidate)}>
              <Play size={16} fill="currentColor" /> Play
            </button>
            <button type="button" className="is-stop" onClick={() => adapters.audition.stop()}>
              <Square size={15} fill="currentColor" /> Stop
            </button>
            <span>Double-click a row to audition.</span>
          </div>
        </section>

        <section className="rhythm-card rhythm-status-card" aria-labelledby="rhythm-status-title">
          <header className="rhythm-card-title">
            <div><span>Selection</span><h3 id="rhythm-status-title">Status</h3></div>
          </header>
          <div className="rhythm-status-body" role="status">
            <span className={`rhythm-status-light is-${state.audition.status}`} />
            <div>
              <strong>
                {state.audition.status === "playing"
                  ? `Playing ${state.audition.label}`
                  : selectedCandidate?.name ?? `Select a ${state.activeTab === "bass" ? "bass phrase" : "drum groove"} to begin`}
              </strong>
              <p>
                {state.audition.status === "playing"
                  ? "Audition-ready render is playing through the connected adapter."
                  : selectedCandidate?.summary ?? "Candidate details appear here without exposing private ranking data."}
              </p>
            </div>
          </div>
          {state.bassCandidateId && (
            <div className="rhythm-ready"><CheckCircle2 size={16} /> Bass phrase selected</div>
          )}
          {state.drumCandidateId && (
            <div className="rhythm-ready"><CheckCircle2 size={16} /> Drum groove selected</div>
          )}
          {project?.appliedSummary && (
            <div className="rhythm-project-state" data-testid="project-rhythm-state">
              <small>Project state</small>
              <strong>{project.appliedSummary}</strong>
              <span>Recipe and render references saved</span>
            </div>
          )}
        </section>

        {state.activeTab === "drums" && (
          <section className="rhythm-card rhythm-fills-card">
            <header className="rhythm-card-title">
              <div><span>For the selected groove</span><h3>Fills</h3></div>
              <strong>{fills.length} {fills.length === 1 ? "fill" : "fills"}</strong>
            </header>
            {!state.drumCandidateId ? (
              <p className="rhythm-empty">Select a groove to see its fills.</p>
            ) : (
              <>
                <div className="rhythm-fill-layout">
                  <div className="rhythm-fill-list" role="listbox" aria-label="Drum fills">
                    {fills.map((fill) => (
                      <button
                        key={fill.id}
                        type="button"
                        role="option"
                        aria-selected={fill.id === state.fillCandidateId}
                        className={fill.id === state.fillCandidateId ? "is-selected" : ""}
                        onClick={() => dispatch({ type: "select-fill", candidateId: fill.id })}
                        onDoubleClick={() => void audition(fill)}
                      >
                        <strong>{fill.name}</strong>
                        <small>{fill.feel} · {fill.lengthLabel}</small>
                      </button>
                    ))}
                  </div>
                  <div className="rhythm-fill-slots">
                    <span>One slot per four bars</span>
                    {slots.map((slot) => {
                      const assigned = fills.find((fill) => fill.id === state.fillSlots[slot.index])
                      return (
                        <button
                          key={slot.index}
                          type="button"
                          disabled={!selectedFill}
                          aria-label={`Assign selected fill to bar ${slot.bar}`}
                          onClick={() => selectedFill && dispatch({
                            type: "assign-fill",
                            slot: slot.index,
                            candidateId: selectedFill.id,
                          })}
                        >
                          <small>Bar {slot.bar}</small>
                          <strong>{assigned?.name ?? "No fill"}</strong>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="rhythm-actions">
                  <button type="button" disabled={!selectedFill} onClick={() => selectedFill && void audition(selectedFill)}>
                    <Play size={16} fill="currentColor" /> Play Fill
                  </button>
                  <button type="button" className="is-stop" onClick={() => adapters.audition.stop()}>
                    <Square size={15} fill="currentColor" /> Stop Fill
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>

      <footer className="rhythm-apply-bar">
        <div>
          <span>Apply selected performances</span>
          <strong>{section ? `${project?.title} · ${section.name}` : "Choose a section"}</strong>
          <p role="status">{state.appliedSummary ?? "This updates project recipes and render references; the browser does not manipulate MIDI."}</p>
        </div>
        <button
          type="button"
          disabled={!canApply || applying}
          onClick={() => void applyToSong()}
        >
          {applying ? <LoaderCircle className="rhythm-spin" size={18} /> : <CheckCircle2 size={18} />}
          {applying ? "Applying…" : "Apply to Song"}
        </button>
      </footer>
    </div>
  )
}
