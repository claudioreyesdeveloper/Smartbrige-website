"use client"

import {
  LoaderCircle,
  Pause,
  Play,
  Plug,
  RotateCcw,
  Sparkles,
  Square,
  TriangleAlert,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { KEYBOARD_PROFILES } from "@/lib/yamaha/profiles"
import {
  createProductionJamAdapters,
  SSR_SAFE_CONNECTION_STATE,
} from "./production"
import { prepareAndPlay } from "./prepare-flow"
import { SectionRecordDialog } from "./section-record-dialog"
import { SongTimeline } from "./song-timeline"
import type {
  DispatchPlaybackState,
  DisplayChord,
  JamPlayerAdapters,
  JamSong,
  JamSongKeyTonality,
  JamSongSummary,
  JamSongTempoBand,
  JamStyleSummary,
  ReharmonizeCandidate,
  YamahaModelId,
} from "./types"
import "./jam-player.css"

type JamPlayerWorkspaceProps = {
  adapters?: JamPlayerAdapters
}

const KEY_OPTIONS = [
  "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B",
] as const

const MODEL_OPTIONS = ["genos", "genos2", "tyros4", "tyros5"] as const satisfies readonly YamahaModelId[]

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

/** Next chord symbol for the live readout (demo parity). */
function upcomingChordLabel(
  song: JamSong | null,
  positionMs: number,
  tempo: number,
): string {
  if (!song || tempo <= 0) return ""
  const beat = (positionMs / 60_000) * tempo
  const beatsPerBar = song.timeSignature[0] || 4
  let cursor = beatsPerBar
  const flat: Array<{ start: number; name: string }> = []
  for (const section of song.sections) {
    for (const chord of section.chords) {
      flat.push({ start: cursor + chord.beat, name: chord.name })
    }
    cursor += section.bars * beatsPerBar
  }
  if (flat.length === 0) return ""
  let currentIndex = 0
  for (let i = 0; i < flat.length; i += 1) {
    if (flat[i]!.start <= beat) currentIndex = i
    else break
  }
  return flat[currentIndex + 1]?.name ?? ""
}

export function JamPlayerWorkspace({ adapters: injected }: JamPlayerWorkspaceProps) {
  const adaptersRef = useRef(injected ?? createProductionJamAdapters())
  const adapters = adaptersRef.current
  const loopGuardRef = useRef(false)
  const didAutoLoadRef = useRef(false)

  const [categories, setCategories] = useState<string[]>([])
  const [category, setCategory] = useState("Pop")
  const [songSearch, setSongSearch] = useState("")
  const [keyTonality, setKeyTonality] = useState<JamSongKeyTonality>("any")
  const [tempoBand, setTempoBand] = useState<JamSongTempoBand>("any")
  const [meterFilter, setMeterFilter] = useState("")
  const [meterOptions, setMeterOptions] = useState<string[]>(["4/4"])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [librarySongs, setLibrarySongs] = useState<JamSongSummary[]>([])
  const [song, setSong] = useState<JamSong | null>(null)
  const [styles, setStyles] = useState<JamStyleSummary[]>([])
  const [styleCategory, setStyleCategory] = useState("All")
  const [styleSearch, setStyleSearch] = useState("")
  const [styleId, setStyleId] = useState("")
  const [key, setKey] = useState("C")
  const [tempo, setTempo] = useState(112)
  const [loop, setLoop] = useState(false)
  const [pickedModel, setPickedModel] = useState<YamahaModelId | null>(null)

  // Correlation id for engine audit only — not a saved cloud project.
  const [engineSessionId] = useState(() => crypto.randomUUID())

  // Stable SSR/client first paint — live MIDI + localStorage preferred model
  // arrive via connection.subscribe in useEffect (see production adapter).
  const [connection, setConnection] = useState(SSR_SAFE_CONNECTION_STATE)
  const [playback, setPlayback] = useState<DispatchPlaybackState>(idlePlayback())

  const [candidates, setCandidates] = useState<ReharmonizeCandidate[]>([])
  const [candidateId, setCandidateId] = useState<string | null>(null)
  const [chordsBySection, setChordsBySection] = useState<Record<
    string,
    DisplayChord[]
  > | null>(null)

  const [planFingerprint, setPlanFingerprint] = useState<string | null>(null)

  const [loadingLibrary, setLoadingLibrary] = useState(true)
  const [loadingSong, setLoadingSong] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [quotaMessage, setQuotaMessage] = useState("")
  const [recordSectionId, setRecordSectionId] = useState<string | null>(null)

  const displaySong = useMemo(
    () => (song ? applyCandidateChords(song, chordsBySection) : null),
    [song, chordsBySection],
  )

  const recordSection = useMemo(
    () =>
      displaySong && recordSectionId
        ? displaySong.sections.find((item) => item.id === recordSectionId) ?? null
        : null,
    [displaySong, recordSectionId],
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
    })
  }, [song, key, tempo, styleId, loop, candidateId])

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
    const search = styleSearch.trim().toLowerCase()
    return styles.filter(
      (style) =>
        (styleCategory === "All" || style.category === styleCategory) &&
        (!search || style.name.toLowerCase().includes(search)),
    )
  }, [styles, styleCategory, styleSearch])

  const selectedStyleVisible =
    Boolean(selectedStyle) &&
    filteredStyles.some((style) => style.id === selectedStyle?.id)

  const markDirty = useCallback(() => {
    setPlanFingerprint(null)
  }, [])

  useEffect(() => adapters.connection.subscribe(setConnection), [adapters.connection])
  useEffect(() => {
    if (connection.model) setPickedModel(connection.model)
  }, [connection.model])
  useEffect(() => {
    // Sticky play/connect banners must not outlive a real connection change.
    if (connection.connected) {
      setErrorMessage("")
      setStatusMessage((current) =>
        current === connection.guidance ? "" : current,
      )
      return
    }
    if (connection.error) {
      setStatusMessage(connection.error)
    }
  }, [connection.connected, connection.error, connection.guidance])
  useEffect(() => adapters.dispatcher.subscribe(setPlayback), [adapters.dispatcher])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingLibrary(true)
      try {
        const [facets, songs] = await Promise.all([
          adapters.catalog.listLibraryFacets(),
          adapters.catalog.listSongs({}),
        ])
        if (cancelled) return
        setCategories(facets.categories)
        setCategoryCounts(facets.categoryCounts)
        setMeterOptions(facets.meters.length > 0 ? facets.meters : ["4/4"])
        setLibrarySongs(songs)
        setCategory((current) => {
          if (current && facets.categories.includes(current)) return current
          if (facets.categories.includes("Pop")) return "Pop"
          return facets.categories[0] ?? "Pop"
        })
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load song library.",
          )
        }
      } finally {
        if (!cancelled) setLoadingLibrary(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [adapters.catalog])

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
        return easy?.id ?? ""
      })
      setStyleSearch("")
    })()
    return () => {
      cancelled = true
    }
  }, [adapters.catalog, connection.model])

  const visibleSongs = useMemo(() => {
    const q = songSearch.trim().toLowerCase()
    return librarySongs.filter((item) => {
      if (category && item.category !== category) return false
      if (keyTonality !== "any") {
        const isMinor = item.key.trim().toLowerCase().endsWith("m")
        if (keyTonality === "major" && isMinor) return false
        if (keyTonality === "minor" && !isMinor) return false
      }
      if (tempoBand === "slow" && !(item.tempo < 90)) return false
      if (tempoBand === "medium" && !(item.tempo >= 90 && item.tempo <= 130)) {
        return false
      }
      if (tempoBand === "fast" && !(item.tempo > 130)) return false
      if (meterFilter) {
        const meter = `${item.timeSignature[0]}/${item.timeSignature[1]}`
        if (meter !== meterFilter) return false
      }
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q)
      )
    })
  }, [librarySongs, category, songSearch, keyTonality, tempoBand, meterFilter])

  const loadSong = useCallback(async (songId: string) => {
    adapters.dispatcher.stop()
    setLoadingSong(true)
    setErrorMessage("")
    setQuotaMessage("")
    setCandidates([])
    setCandidateId(null)
    setChordsBySection(null)
    setPlanFingerprint(null)
    setStatusMessage("")
    try {
      const next = await adapters.catalog.getSong(songId)
      setSong(next)
      setKey(next.key)
      setTempo(next.tempo)
      setCandidates(next.reharmonizations ?? [])
      setPlanFingerprint(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load song.")
    } finally {
      setLoadingSong(false)
    }
  }, [adapters.catalog, adapters.dispatcher])

  // Demo parity: first song is ready as soon as the library arrives.
  useEffect(() => {
    if (didAutoLoadRef.current || loadingLibrary || song || librarySongs.length === 0) {
      return
    }
    const inCategory = librarySongs.filter((item) => item.category === category)
    const first = inCategory[0] ?? librarySongs[0]
    if (!first) return
    didAutoLoadRef.current = true
    void loadSong(first.id)
  }, [category, librarySongs, loadSong, loadingLibrary, song])

  // Keep a song selected when switching categories (demo behavior).
  useEffect(() => {
    if (!song || loadingLibrary || librarySongs.length === 0) return
    const visible = librarySongs.filter((item) => !category || item.category === category)
    if (visible.some((item) => item.id === song.id)) return
    const next = visible[0]
    if (next) void loadSong(next.id)
  }, [category, librarySongs, loadSong, loadingLibrary, song])

  const playArrangement = useCallback(
    async (mode: "full" | "section", sectionId?: string) => {
      setErrorMessage("")
      setQuotaMessage("")
      if (!connection.browserSupported || !connection.connected || !connection.model) {
        setStatusMessage(
          "Connect a supported Yamaha keyboard before starting the arrangement.",
        )
        return
      }
      if (!displaySong || !styleId) {
        setStatusMessage("Pick a song and style, then play.")
        return
      }
      if (!selectedStyle) {
        setStatusMessage("Choose a Yamaha style before playing.")
        return
      }

      const request = {
        projectId: engineSessionId,
        model: connection.model,
        song: displaySong,
        key,
        tempo,
        styleId,
        styleNumber: selectedStyle.styleNumber,
        loop,
        candidateId,
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
      engineSessionId,
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

  const stopPlayback = () => {
    // production dispatcher.stop sends ARRANGER_COMMANDS.stop + MIDI Stop + panic
    adapters.dispatcher.stop()
    loopGuardRef.current = true
    setStatusMessage("")
  }

  const togglePlay = () => {
    if (playing) {
      stopPlayback()
      return
    }
    void playArrangement("full")
  }

  const restartPlayback = () => {
    stopPlayback()
    void playArrangement("full")
  }

  const selectCandidate = (id: string | null) => {
    setCandidateId(id)
    if (!id) {
      setChordsBySection(null)
      setStatusMessage("Original chords restored.")
    } else {
      const found = candidates.find((item) => item.id === id)
      setChordsBySection(found?.chordsBySection ?? null)
      setStatusMessage(
        found ? `${found.label} reharmonization selected.` : "Candidate selected.",
      )
    }
    markDirty()
  }

  const connectKeyboard = async () => {
    const model = pickedModel ?? connection.model
    if (!model) {
      setStatusMessage("Choose Genos, Genos2, Tyros4, or Tyros5, then connect.")
      return
    }
    setStatusMessage("Connecting…")
    try {
      await adapters.connection.connect(model)
      setStatusMessage("")
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not connect the keyboard.",
      )
    }
  }

  const busy = preparing || loadingSong
  const playing = playback.status === "playing"
  const nextChord = upcomingChordLabel(displaySong, playback.positionMs, tempo)

  /** Demo parity: send style SysEx immediately; keep styleId for the next prepare. */
  const applyStyle = useCallback(
    (style: JamStyleSummary, options?: { syncSearch?: boolean }) => {
      setStyleId(style.id)
      if (options?.syncSearch) setStyleSearch(style.name)
      else setStyleSearch("")
      markDirty()
      if (!connection.connected) {
        setStatusMessage(`${style.name} selected. Connect your keyboard to hear it.`)
        return
      }
      try {
        adapters.connection.changeStyle(style)
        setStatusMessage(
          playing
            ? `Same arrangement, now playing ${style.name} on ${connection.displayName ?? "your keyboard"}.`
            : `${style.name} selected on your ${connection.displayName ?? "keyboard"}.`,
        )
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : "Could not change style.",
        )
      }
    },
    [
      adapters.connection,
      connection.connected,
      connection.displayName,
      markDirty,
      playing,
    ],
  )
  const totalSongs = categoryCounts.All ?? librarySongs.length
  const activeModel = pickedModel ?? connection.model

  return (
    <div
      className={`paid-jam app-shell-workspace${connection.browserSupported ? "" : " is-unsupported"}`}
    >
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

      <div className="jam-layout paid-jam-demo-shell">
        <aside className="jam-library" aria-label="Song library">
          <div className="panel-heading">
            <span>Song library</span>
            <strong>
              {totalSongs
                ? `${totalSongs} complete arrangements`
                : "Factory arrangements"}
            </strong>
          </div>
          <div className="category-tabs" role="tablist" aria-label="Song categories">
            {loadingLibrary && categories.length === 0 ? (
              <p className="paid-jam-muted">
                <LoaderCircle className="paid-jam-spin" size={16} aria-hidden="true" />
                Loading…
              </p>
            ) : (
              categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === category ? "is-active" : ""}
                  onClick={() => setCategory(item)}
                >
                  {item}
                  <span>{categoryCounts[item] ?? 0}</span>
                </button>
              ))
            )}
          </div>
          <div className="song-list">
            {loadingLibrary ? (
              <p className="paid-jam-muted">Loading songs…</p>
            ) : visibleSongs.length === 0 ? (
              <p className="paid-jam-muted">No songs in this category.</p>
            ) : (
              visibleSongs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === song?.id ? "is-active" : ""}
                  onClick={() => {
                    stopPlayback()
                    void loadSong(item.id)
                  }}
                  disabled={busy && item.id !== song?.id}
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
        </aside>

        <section className="jam-stage">
          <header className="jam-song-header">
            <div
              className="song-art"
              style={
                {
                  "--song-accent": displaySong?.accent ?? "#4db8ff",
                } as CSSProperties
              }
            >
              <Sparkles size={26} aria-hidden="true" />
              <span>SB</span>
            </div>
            <div>
              <span className="demo-eyebrow">
                {displaySong?.category ?? "Song"} · Original progression
              </span>
              <h1>
                {loadingSong ? "Loading…" : displaySong?.title ?? "Loading song…"}
              </h1>
              <p>
                {displaySong?.subtitle ??
                  "Connect your keyboard, then press Play arrangement."}
              </p>
            </div>
            <div className="song-facts">
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
                  {displaySong
                    ? `${displaySong.timeSignature[0]}/${displaySong.timeSignature[1]}`
                    : "—"}
                </strong>
              </span>
            </div>
          </header>

          {!connection.connected && connection.browserSupported && (
            <div className="paid-jam-connect-strip" role="region" aria-label="Connect keyboard">
              <div>
                <span className="demo-eyebrow">Step 1</span>
                <strong>Connect your Yamaha keyboard</strong>
                <p>Choose a model, then connect over USB. Same flow as the live demo.</p>
              </div>
              <div className="paid-jam-connect-models" role="group" aria-label="Keyboard model">
                {MODEL_OPTIONS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={activeModel === id ? "is-selected" : ""}
                    aria-pressed={activeModel === id}
                    disabled={connection.connecting}
                    onClick={() => setPickedModel(id)}
                  >
                    {KEYBOARD_PROFILES[id].displayName}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="paid-jam-connect-action"
                disabled={connection.connecting || !activeModel}
                onClick={() => void connectKeyboard()}
              >
                <Plug size={16} aria-hidden="true" />
                {connection.connecting ? "Connecting…" : "Connect my keyboard"}
              </button>
            </div>
          )}

          <div className="performance-strip">
            <button
              className="transport-main"
              type="button"
              onClick={togglePlay}
              disabled={(busy && !playing) || !displaySong}
            >
              {preparing ? (
                <LoaderCircle className="paid-jam-spin" size={22} aria-hidden="true" />
              ) : playing ? (
                <Pause size={22} aria-hidden="true" />
              ) : (
                <Play size={22} fill="currentColor" aria-hidden="true" />
              )}
              {preparing ? "Starting…" : playing ? "Pause" : "Play arrangement"}
            </button>
            <button
              className="transport-stop"
              type="button"
              onClick={stopPlayback}
              disabled={!playing && playback.status !== "completed"}
            >
              <Square size={17} fill="currentColor" aria-hidden="true" /> Stop
            </button>
            <button
              className="transport-stop"
              type="button"
              onClick={restartPlayback}
              disabled={!playing && !planMatchesRequest}
            >
              <RotateCcw size={17} aria-hidden="true" /> Restart
            </button>
            <div className="live-readout" aria-live="polite">
              <span>
                <small>Now</small>
                <strong>{playback.currentChord || "—"}</strong>
              </span>
              <span>
                <small>Next</small>
                <strong>{nextChord || "—"}</strong>
              </span>
              <span>
                <small>Arranger</small>
                <strong>
                  {playing ? "Playing" : connection.connected ? "Ready" : "Idle"}
                </strong>
              </span>
            </div>
          </div>

          <div className="genre-transform">
            <div>
              <span className="demo-eyebrow">Transform the keyboard</span>
              <strong>
                Choose any factory style on your{" "}
                {connection.displayName ?? "Yamaha keyboard"}.
              </strong>
              <label className="reharm-control">
                <span>Reharmonization</span>
                <select
                  value={candidateId ?? ""}
                  aria-label="Reharmonization"
                  disabled={!song || candidates.length === 0}
                  onChange={(event) =>
                    selectCandidate(event.target.value ? event.target.value : null)
                  }
                >
                  <option value="">Original</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="style-catalog-controls">
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
                  if (exact) applyStyle(exact, { syncSearch: true })
                }}
              />
              <datalist id="paid-jam-style-suggestions">
                {filteredStyles.map((style) => (
                  <option key={style.id} value={style.name}>
                    {style.category}
                  </option>
                ))}
              </datalist>
              <select
                value={styleCategory}
                aria-label="Style category"
                onChange={(event) => {
                  setStyleCategory(event.target.value)
                  setStyleSearch("")
                }}
              >
                {styleCategories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select
                value={
                  selectedStyleVisible && selectedStyle ? selectedStyle.id : ""
                }
                aria-label="Yamaha style"
                onChange={(event) => {
                  const next = styles.find((style) => style.id === event.target.value)
                  if (next) applyStyle(next)
                }}
              >
                <option value="" disabled>
                  {filteredStyles.length
                    ? "Choose a matching style"
                    : "No matching styles"}
                </option>
                {filteredStyles.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                    {style.bpm ? ` · ${style.bpm} BPM` : ""}
                  </option>
                ))}
              </select>
              <span>{selectedStyle?.name || "No style available"}</span>
            </div>
          </div>

          <details className="paid-jam-more">
            <summary>Adjust key, tempo, or loop</summary>
            <div className="paid-jam-compact-controls">
              <label>
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
              <label>
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
          </details>

          {statusMessage && (
            <div className="demo-status" role="status">
              {statusMessage}
            </div>
          )}

          {displaySong ? (
            <SongTimeline
              song={{ ...displaySong, tempo, key }}
              playback={playback}
              disabled={busy && !playing}
              onPlaySection={(sectionId) => void playArrangement("section", sectionId)}
              onRecordSection={(sectionId) => {
                adapters.dispatcher.stop()
                setRecordSectionId(sectionId)
              }}
            />
          ) : (
            <p className="paid-jam-muted">
              <LoaderCircle className="paid-jam-spin" size={16} aria-hidden="true" />
              Loading arrangement…
            </p>
          )}
        </section>
      </div>

      {displaySong && recordSection ? (
        <SectionRecordDialog
          open
          section={recordSection}
          songTitle={displaySong.title}
          tempo={tempo}
          beatsPerBar={displaySong.timeSignature[0]}
          onClose={() => setRecordSectionId(null)}
        />
      ) : null}
    </div>
  )
}
