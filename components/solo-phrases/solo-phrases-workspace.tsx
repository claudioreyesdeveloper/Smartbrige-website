"use client"

import {
  Check,
  CheckCircle2,
  CircleStop,
  Headphones,
  LoaderCircle,
  Music2,
  Play,
  RefreshCw,
  Save,
  Sparkles,
  Square,
  TriangleAlert,
} from "lucide-react"
import { useEffect, useReducer, useRef, useState } from "react"
import {
  initialSoloWorkspaceState,
  soloWorkspaceReducer,
  supportsSoloWorkspace,
} from "./state"
import type {
  PreparedSoloAudition,
  SoloOptionCatalog,
  SoloPhrasesAdapters,
  SoloProject,
  SoloSelections,
  SoloTakeSummary,
} from "./types"
import "./solo-phrases.css"

const EMPTY_OPTIONS: SoloOptionCatalog = {
  instruments: [],
  styles: [],
  lineFeels: [],
  grooves: [],
  voicings: [],
}

const EMPTY_SELECTIONS: SoloSelections = {
  instrumentId: "",
  styleId: "",
  lineFeelId: "",
  grooveId: "",
  voicingId: "",
}

export function SoloPhrasesWorkspace({
  adapters,
}: {
  adapters: SoloPhrasesAdapters
}) {
  const adaptersRef = useRef(adapters)
  const activeAdapters = adaptersRef.current
  const [state, dispatch] = useReducer(
    soloWorkspaceReducer,
    initialSoloWorkspaceState,
  )
  const [supported, setSupported] = useState<boolean | null>(null)
  const [projects, setProjects] = useState<SoloProject[]>([])
  const [options, setOptions] = useState(EMPTY_OPTIONS)
  const [selections, setSelections] = useState(EMPTY_SELECTIONS)
  const [contextStatus, setContextStatus] = useState(
    "Choose settings, then generate several takes.",
  )
  const [error, setError] = useState("")

  const project = projects.find((item) => item.id === state.projectId) ?? null
  const section =
    project?.sections.find((item) => item.id === state.sectionId) ?? null
  const selectedTake =
    state.takes.find((item) => item.takeId === state.selectedTakeId) ?? null

  useEffect(() => {
    setSupported(
      supportsSoloWorkspace(navigator.userAgent, window.isSecureContext),
    )
  }, [])

  useEffect(
    () =>
      activeAdapters.audition.subscribe((playback) =>
        dispatch({ type: "playback", playback }),
      ),
    [activeAdapters.audition],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const projectList = await activeAdapters.projects.list()
        if (cancelled) return
        setProjects(projectList)
        const firstProject = projectList[0]
        if (!firstProject) {
          setError("No projects are available.")
          return
        }
        const [opened, nextOptions] = await Promise.all([
          activeAdapters.projects.open(firstProject.id),
          activeAdapters.generator.getOptions(firstProject.id),
        ])
        if (cancelled) return
        setProjects((current) =>
          current.map((item) => (item.id === opened.id ? opened : item)),
        )
        setOptions(nextOptions)
        setSelections({
          instrumentId: nextOptions.instruments[0]?.id ?? "",
          styleId: nextOptions.styles[0]?.id ?? "",
          lineFeelId: nextOptions.lineFeels[1]?.id ?? nextOptions.lineFeels[0]?.id ?? "",
          grooveId: nextOptions.grooves[0]?.id ?? "",
          voicingId: nextOptions.voicings[0]?.id ?? "",
        })
        const firstSection = opened.sections[0]
        dispatch({
          type: "open-context",
          projectId: opened.id,
          sectionId: firstSection?.id ?? null,
          savedTake: firstSection
            ? opened.savedTakeBySection[firstSection.id] ?? null
            : null,
        })
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Solo workspace could not open.",
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeAdapters.generator, activeAdapters.projects])

  const openProject = async (projectId: string) => {
    activeAdapters.audition.stop()
    setError("")
    try {
      const [opened, nextOptions] = await Promise.all([
        activeAdapters.projects.open(projectId),
        activeAdapters.generator.getOptions(projectId),
      ])
      setProjects((current) =>
        current.map((item) => (item.id === opened.id ? opened : item)),
      )
      setOptions(nextOptions)
      const firstSection = opened.sections[0]
      dispatch({
        type: "open-context",
        projectId: opened.id,
        sectionId: firstSection?.id ?? null,
        savedTake: firstSection
          ? opened.savedTakeBySection[firstSection.id] ?? null
          : null,
      })
      setContextStatus(`Opened ${opened.title}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Project could not open.")
    }
  }

  const selectSection = (sectionId: string) => {
    activeAdapters.audition.stop()
    dispatch({
      type: "select-section",
      sectionId,
      savedTake: project?.savedTakeBySection[sectionId] ?? null,
    })
    const nextSection = project?.sections.find((item) => item.id === sectionId)
    setContextStatus(
      nextSection
        ? `Ready to generate for ${nextSection.name}.`
        : "Choose a section.",
    )
  }

  const updateSelection = (name: keyof SoloSelections, value: string) => {
    activeAdapters.audition.stop()
    setSelections((current) => ({ ...current, [name]: value }))
  }

  const generateTakes = async () => {
    if (!project || !section) return
    activeAdapters.audition.stop()
    setError("")
    dispatch({ type: "generation-started" })
    setContextStatus(`Generating takes for ${section.name}…`)
    try {
      const result = await activeAdapters.generator.generateTakes({
        projectId: project.id,
        sectionId: section.id,
        contextRevision: section.contextRevision,
        selections,
        takeCount: 4,
      })
      dispatch({ type: "generation-completed", takes: result.takes })
      setContextStatus(result.contextStatusLabel)
    } catch (cause) {
      dispatch({ type: "operation-failed" })
      setError(cause instanceof Error ? cause.message : "Takes could not be generated.")
    }
  }

  const prepareSelected = async (
    take: SoloTakeSummary,
  ): Promise<PreparedSoloAudition | null> => {
    if (!project || !section) return null
    if (state.preparedAudition?.takeId === take.takeId) {
      return state.preparedAudition
    }
    const prepared = await activeAdapters.generator.prepareAudition({
      projectId: project.id,
      sectionId: section.id,
      contextRevision: section.contextRevision,
      takeId: take.takeId,
    })
    dispatch({ type: "audition-prepared", audition: prepared })
    return prepared
  }

  const startAudition = async (take: SoloTakeSummary) => {
    setError("")
    try {
      const prepared = await prepareSelected(take)
      if (prepared) await activeAdapters.audition.start(prepared, take.label)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Audition could not start.")
    }
  }

  const saveSelectedTake = async () => {
    if (!project || !section || !selectedTake) return
    setError("")
    dispatch({ type: "saving-started" })
    try {
      const prepared = await prepareSelected(selectedTake)
      if (!prepared) throw new Error("Selected take could not be prepared.")
      const result = await activeAdapters.generator.saveTake({
        projectId: project.id,
        sectionId: section.id,
        contextRevision: section.contextRevision,
        take: selectedTake,
        audition: prepared,
      })
      setProjects((current) =>
        current.map((item) =>
          item.id === result.project.id ? result.project : item,
        ),
      )
      dispatch({ type: "saved", savedTake: result.savedTake })
      setContextStatus(result.message)
    } catch (cause) {
      dispatch({ type: "operation-failed" })
      setError(cause instanceof Error ? cause.message : "Take could not be saved.")
    }
  }

  if (supported === null) {
    return (
      <div className="solo-compatibility-check">
        Checking desktop compatibility…
      </div>
    )
  }

  if (!supported) {
    return (
      <section className="solo-compatibility-stop" role="alert">
        <TriangleAlert size={38} aria-hidden="true" />
        <div>
          <span>Desktop workspace required</span>
          <h2>Open Solo Phrases in Chrome or Microsoft Edge on a computer.</h2>
          <p>
            Phones, tablets, Safari, Firefox, and insecure browser sessions are
            not supported for this workspace.
          </p>
        </div>
      </section>
    )
  }

  const optionFields = [
    ["styleId", "Style", options.styles],
    ["instrumentId", "Instrument", options.instruments],
    ["lineFeelId", "Feel of the lines", options.lineFeels],
    ["grooveId", "Groove", options.grooves],
    ["voicingId", "Voicing", options.voicings],
  ] as const

  return (
    <div className="solo-workspace app-shell-workspace">
      <section className="solo-context" aria-labelledby="solo-context-title">
        <div className="solo-context-heading">
          <span>Project context</span>
          <h2 id="solo-context-title">{project?.title ?? "Choose a project"}</h2>
        </div>
        <label>
          <span>Project</span>
          <select
            aria-label="Project"
            value={state.projectId ?? ""}
            onChange={(event) => void openProject(event.target.value)}
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
            onChange={(event) => selectSection(event.target.value)}
          >
            {project?.sections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="solo-context-facts">
          <span><small>Section</small><strong>{section?.name ?? "—"}</strong></span>
          <span><small>Length</small><strong>{section ? `${section.bars} bars` : "—"}</strong></span>
          <span><small>Tempo</small><strong>{project?.tempoLabel ?? "—"}</strong></span>
          <span><small>Key</small><strong>{project?.keyLabel ?? "—"}</strong></span>
        </div>
        <div className="solo-chords">
          <small>Section chords</small>
          <strong>{section?.chordContextLabel ?? "—"}</strong>
          <span role="status"><RefreshCw size={14} aria-hidden="true" /> {contextStatus}</span>
        </div>
      </section>

      {error && (
        <div className="solo-alert" role="alert">
          <TriangleAlert size={18} aria-hidden="true" /> {error}
        </div>
      )}

      <div className="solo-view-tab" role="tablist" aria-label="Solo workspace view">
        <button type="button" role="tab" aria-selected="true">
          <Sparkles size={17} aria-hidden="true" /> Solo Ideas
        </button>
      </div>

      <div className="solo-panel-grid">
        <section className="solo-card solo-generator-card">
          <header className="solo-card-title">
            <div><span>Generate instrumental solo</span><h3>Solo setup</h3></div>
            <strong>{state.takes.length ? `${state.takes.length} takes` : "Ready"}</strong>
          </header>
          <div className="solo-options">
            {optionFields.map(([name, label, fieldOptions]) => (
              <label key={name}>
                <span>{label}</span>
                <select
                  aria-label={label}
                  value={selections[name]}
                  onChange={(event) => updateSelection(name, event.target.value)}
                >
                  {fieldOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button
              type="button"
              className="solo-generate"
              disabled={!section || state.generating}
              onClick={() => void generateTakes()}
            >
              {state.generating ? (
                <LoaderCircle className="solo-spin" size={18} />
              ) : (
                <Sparkles size={18} />
              )}
              {state.generating ? "Generating…" : "Generate 4 Takes"}
            </button>
          </div>

          <div className="solo-take-list" role="listbox" aria-label="Generated solo takes">
            {state.generating ? (
              <p className="solo-empty">
                <LoaderCircle className="solo-spin" size={18} /> Building several
                takes for this section…
              </p>
            ) : state.takes.length === 0 ? (
              <p className="solo-empty">
                Choose a style and instrument, then generate several takes.
              </p>
            ) : (
              state.takes.map((take) => {
                const selected = take.takeId === state.selectedTakeId
                const playing =
                  state.playback.status === "playing" &&
                  state.playback.takeId === take.takeId
                return (
                  <button
                    key={take.takeId}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={selected ? "is-selected" : ""}
                    onClick={() => {
                      activeAdapters.audition.stop()
                      dispatch({ type: "select-take", takeId: take.takeId })
                    }}
                    onDoubleClick={() => void startAudition(take)}
                  >
                    <span className={`solo-take-icon${playing ? " is-playing" : ""}`}>
                      {playing ? <Headphones size={16} /> : <Music2 size={16} />}
                    </span>
                    <span>
                      <strong>{take.label}</strong>
                      <small>
                        {take.instrumentLabel} · {take.styleLabel} · {take.lineFeelLabel}
                      </small>
                      <em>{take.description}</em>
                    </span>
                    <b>{take.durationLabel}</b>
                  </button>
                )
              })
            )}
          </div>

          <div className="solo-actions">
            <button
              type="button"
              disabled={!selectedTake}
              onClick={() => selectedTake && void startAudition(selectedTake)}
            >
              <Play size={16} fill="currentColor" /> Start
            </button>
            <button
              type="button"
              className="is-stop"
              onClick={() => activeAdapters.audition.stop()}
            >
              <Square size={15} fill="currentColor" /> Stop
            </button>
            <span>Double-click a take to audition.</span>
          </div>
        </section>

        <aside className="solo-card solo-selection-card">
          <header className="solo-card-title">
            <div><span>Current take</span><h3>Selection</h3></div>
          </header>
          <div className="solo-playback-status" role="status">
            <span className={`solo-status-light is-${state.playback.status}`} />
            <div>
              <strong>
                {state.playback.status === "playing"
                  ? state.playback.statusLabel
                  : selectedTake?.label ?? "Select a take"}
              </strong>
              <p>
                {selectedTake?.description ??
                  "Generated take details and audition status appear here."}
              </p>
            </div>
          </div>
          {selectedTake && (
            <dl className="solo-take-details">
              <div><dt>Instrument</dt><dd>{selectedTake.instrumentLabel}</dd></div>
              <div><dt>Style</dt><dd>{selectedTake.styleLabel}</dd></div>
              <div><dt>Groove</dt><dd>{selectedTake.grooveLabel}</dd></div>
              <div><dt>Length</dt><dd>{selectedTake.durationLabel}</dd></div>
            </dl>
          )}
          {state.savedTake ? (
            <div className="solo-saved-state" data-testid="saved-solo-state">
              <CheckCircle2 size={18} aria-hidden="true" />
              <div>
                <small>Saved for this section</small>
                <strong>{state.savedTake.label}</strong>
                <span>
                  {state.savedTake.instrumentLabel} · {state.savedTake.durationLabel}
                </span>
              </div>
            </div>
          ) : (
            <div className="solo-not-saved">
              <CircleStop size={17} aria-hidden="true" />
              No take saved for this section
            </div>
          )}
        </aside>
      </div>

      <footer className="solo-save-bar">
        <div>
          <span>Select one take</span>
          <strong>
            {selectedTake
              ? `${selectedTake.label} · ${project?.title} · ${section?.name}`
              : "Generate and select a take"}
          </strong>
          <p role="status">
            {state.savedTake?.statusLabel ??
              "Your selected take will be restored when this project is reopened."}
          </p>
        </div>
        <button
          type="button"
          disabled={!selectedTake || state.saving}
          onClick={() => void saveSelectedTake()}
        >
          {state.saving ? (
            <LoaderCircle className="solo-spin" size={18} />
          ) : state.savedTake?.takeId === selectedTake?.takeId ? (
            <Check size={18} />
          ) : (
            <Save size={18} />
          )}
          {state.saving
            ? "Saving…"
            : state.savedTake?.takeId === selectedTake?.takeId
              ? "Saved"
              : "Save Selected Take"}
        </button>
      </footer>
    </div>
  )
}
