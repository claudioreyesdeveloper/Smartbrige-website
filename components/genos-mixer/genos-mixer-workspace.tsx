"use client"

import {
  Check,
  LoaderCircle,
  Music2,
  RefreshCw,
  Search,
  TriangleAlert,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { useEffect, useMemo, useReducer, useState } from "react"
import {
  channelsForPage,
  initialMixerWorkspaceState,
  mixerWorkspaceReducer,
  supportsGenosMixer,
} from "./state"
import { createProductionGenosMixerAdapters } from "./production"
import type {
  GenosMixerAdapters,
  MixerChannel,
  MixerConnectionState,
  MixerProject,
  MixerVoice,
} from "./types"
import "./genos-mixer.css"

type LevelField = "volume" | "pan" | "reverb" | "chorus"

const levelLabels: Record<LevelField, string> = {
  volume: "Volume",
  pan: "Pan",
  reverb: "Reverb",
  chorus: "Chorus",
}

export function GenosMixerWorkspace({ adapters: injected }: { adapters?: GenosMixerAdapters }) {
  const [adapters] = useState(() => injected ?? createProductionGenosMixerAdapters())
  const [state, dispatch] = useReducer(mixerWorkspaceReducer, initialMixerWorkspaceState)
  const [supported, setSupported] = useState<boolean | null>(null)
  const [connection, setConnection] = useState<MixerConnectionState>(
    adapters.device.getState(),
  )
  const [projects, setProjects] = useState<MixerProject[]>([])
  const [projectId, setProjectId] = useState("")
  const [projectStatus, setProjectStatus] = useState("Opening project…")
  const [error, setError] = useState("")
  const [voiceQuery, setVoiceQuery] = useState("")
  const [voiceResults, setVoiceResults] = useState<readonly MixerVoice[]>([])
  const [voiceLoading, setVoiceLoading] = useState(false)

  const visibleChannels = useMemo(() => channelsForPage(state), [state])
  const voiceChannel = state.channels.find(
    (channel) => channel.part === state.selectedVoicePart,
  )

  useEffect(() => {
    setSupported(supportsGenosMixer(navigator.userAgent, window.isSecureContext))
  }, [])

  useEffect(
    () => adapters.device.subscribe(setConnection),
    [adapters.device],
  )

  useEffect(() => () => {
    if (!injected) adapters.dispose?.()
  }, [adapters, injected])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const available = await adapters.projects.list()
        if (cancelled) return
        setProjects(available)
        const first = available[0]
        if (!first) {
          setProjectStatus("No project available")
          return
        }
        const opened = await adapters.projects.open(first.id)
        if (cancelled) return
        setProjectId(opened.id)
        dispatch({ type: "replace-channels", channels: opened.channels })
        setProjectStatus(`${opened.title} open`)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Project could not be opened.")
          setProjectStatus("Project unavailable")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [adapters.projects])

  useEffect(() => {
    if (state.selectedVoicePart === null) return
    let cancelled = false
    setVoiceLoading(true)
    ;(async () => {
      try {
        const results = await adapters.voices.search(voiceQuery)
        if (!cancelled) setVoiceResults(results)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Voices could not be searched.")
        }
      } finally {
        if (!cancelled) setVoiceLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [adapters.voices, state.selectedVoicePart, voiceQuery])

  if (supported === null) {
    return <div className="mixer-compatibility-check">Checking desktop compatibility…</div>
  }

  if (!supported) {
    return (
      <section className="mixer-compatibility-stop" role="alert">
        <TriangleAlert aria-hidden="true" />
        <div>
          <h2>Genos Mixer requires a supported desktop</h2>
          <p>Use secure desktop Chrome or Microsoft Edge. Phones, tablets, and Safari are not supported.</p>
        </div>
      </section>
    )
  }

  const changeLevel = (channel: MixerChannel, field: LevelField, value: number) => {
    const next = { ...channel, [field]: value }
    try {
      adapters.device.updateChannel(next, field)
      dispatch({ type: "change-level", part: channel.part, field, value })
      setProjectStatus("Unsaved mixer changes")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mixer control failed.")
    }
  }

  const toggleMute = (channel: MixerChannel) => {
    const next = { ...channel, mute: !channel.mute }
    try {
      adapters.device.updateChannel(next, "mute")
      dispatch({ type: "toggle-mute", part: channel.part })
      setProjectStatus("Unsaved mixer changes")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mixer mute failed.")
    }
  }

  const refresh = async () => {
    setError("")
    try {
      const channels = await adapters.device.refresh()
      dispatch({ type: "replace-channels", channels })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mixer refresh failed.")
    }
  }

  const save = async () => {
    if (!projectId) return
    setError("")
    setProjectStatus("Saving mixer…")
    try {
      const saved = await adapters.projects.save(projectId, state.channels)
      setProjects((items) => items.map((item) => item.id === saved.id ? saved : item))
      setProjectStatus("Mixer saved in project")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mixer could not be saved.")
      setProjectStatus("Save failed")
    }
  }

  const reopen = async () => {
    if (!projectId) return
    setError("")
    setProjectStatus("Reopening mixer…")
    try {
      const opened = await adapters.projects.open(projectId)
      dispatch({ type: "replace-channels", channels: opened.channels })
      setProjectStatus("Saved mixer reopened")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mixer could not be reopened.")
      setProjectStatus("Reopen failed")
    }
  }

  const selectVoice = (voice: MixerVoice) => {
    if (!voiceChannel) return
    const next = {
      ...voiceChannel,
      voiceId: voice.id,
      voiceName: voice.name,
      known: true,
    }
    try {
      adapters.device.updateChannel(next, "voice")
      dispatch({ type: "select-voice", part: voiceChannel.part, voice })
      setProjectStatus("Unsaved mixer changes")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Voice selection failed.")
    }
  }

  return (
    <div className="genos-mixer">
      <section className="mixer-command-bar" aria-label="Mixer status and project">
        <div className={`mixer-device-status is-${connection.phase}`} role="status">
          <span className="mixer-device-light" aria-hidden="true" />
          <div>
            <strong>{connection.model ?? "Model unknown"}</strong>
            <span>{connection.message}</span>
          </div>
        </div>

        {connection.phase === "refreshing" && (
          <div className="mixer-refresh-progress">
            <span>{Math.round(connection.progress * 100)}%</span>
            <progress value={connection.progress} max={1}>
              {Math.round(connection.progress * 100)}%
            </progress>
          </div>
        )}

        <div className="mixer-project-controls">
          <label>
            <span>Project</span>
            <select
              aria-label="Project"
              value={projectId}
              onChange={async (event) => {
                const opened = await adapters.projects.open(event.target.value)
                setProjectId(opened.id)
                dispatch({ type: "replace-channels", channels: opened.channels })
                setProjectStatus(`${opened.title} open`)
              }}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </label>
          <button type="button" className="mixer-button" onClick={refresh} disabled={connection.phase === "refreshing"}>
            {connection.phase === "refreshing"
              ? <LoaderCircle className="mixer-spin" size={16} />
              : <RefreshCw size={16} />}
            Refresh
          </button>
          <button type="button" className="mixer-button is-primary" onClick={save} disabled={!projectId}>
            <Check size={16} /> Save Mixer
          </button>
          <button type="button" className="mixer-button" onClick={reopen} disabled={!projectId}>
            Reopen
          </button>
        </div>
      </section>

      <div className="mixer-feedback-row">
        <p role="status">{projectStatus}</p>
        {error && <p className="mixer-error" role="alert"><TriangleAlert size={16} /> {error}</p>}
      </div>

      <div className="mixer-page-tabs" role="tablist" aria-label="Mixer channels">
        <button
          type="button"
          role="tab"
          aria-selected={state.page === "style"}
          className={state.page === "style" ? "is-active" : ""}
          onClick={() => dispatch({ type: "select-page", page: "style" })}
        >
          Style (1-16)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={state.page === "song"}
          className={state.page === "song" ? "is-active" : ""}
          onClick={() => dispatch({ type: "select-page", page: "song" })}
        >
          Song (17-32)
        </button>
      </div>

      <section
        className="mixer-console"
        aria-label={state.page === "style" ? "Style channels 1 to 16" : "Song channels 17 to 32"}
      >
        <div className="mixer-console-scroll">
          {visibleChannels.map((channel) => (
            <article
              className={`mixer-channel${channel.mute ? " is-muted" : ""}${channel.known ? "" : " is-unknown"}`}
              key={channel.part}
              aria-label={`Channel ${channel.part}, ${channel.label}`}
            >
              <header>
                <span className="mixer-channel-number">{channel.part}</span>
                <strong>{channel.label}</strong>
              </header>

              <button
                type="button"
                className="mixer-voice"
                onClick={() => {
                  setVoiceQuery("")
                  dispatch({ type: "open-voice", part: channel.part })
                }}
                aria-label={`Choose voice for ${channel.label}`}
              >
                <Music2 size={17} aria-hidden="true" />
                <span>{channel.voiceName}</span>
                <Search size={14} aria-hidden="true" />
              </button>

              <label className="mixer-fader">
                <span>Volume</span>
                <output>{channel.volume}</output>
                <input
                  aria-label={`${channel.label} volume`}
                  type="range"
                  min="0"
                  max="127"
                  value={channel.volume}
                  onChange={(event) => changeLevel(channel, "volume", Number(event.target.value))}
                />
              </label>

              <div className="mixer-send-controls">
                {(["pan", "reverb", "chorus"] as const).map((field) => (
                  <label key={field}>
                    <span>{levelLabels[field]}</span>
                    <output>{channel[field]}</output>
                    <input
                      aria-label={`${channel.label} ${field}`}
                      type="range"
                      min="0"
                      max="127"
                      value={channel[field]}
                      onChange={(event) => changeLevel(channel, field, Number(event.target.value))}
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                className={`mixer-mute${channel.mute ? " is-active" : ""}`}
                aria-pressed={channel.mute}
                onClick={() => toggleMute(channel)}
              >
                {channel.mute ? <VolumeX size={17} /> : <Volume2 size={17} />}
                {channel.mute ? "Muted" : "Mute"}
              </button>
            </article>
          ))}
        </div>
      </section>

      {voiceChannel && (
        <div className="mixer-dialog-backdrop" role="presentation">
          <section className="mixer-voice-dialog" role="dialog" aria-modal="true" aria-labelledby="voice-dialog-title">
            <header>
              <div>
                <p>Channel {voiceChannel.part} · {voiceChannel.label}</p>
                <h2 id="voice-dialog-title">Select Voice</h2>
              </div>
              <button type="button" aria-label="Close voice search" onClick={() => dispatch({ type: "close-voice" })}>
                <X />
              </button>
            </header>
            <label className="mixer-voice-search">
              <Search size={18} aria-hidden="true" />
              <input
                autoFocus
                aria-label="Search voices"
                placeholder="Search voice or category"
                value={voiceQuery}
                onChange={(event) => setVoiceQuery(event.target.value)}
              />
            </label>
            <div className="mixer-voice-results" role="listbox" aria-label="Voice results">
              {voiceLoading ? (
                <p><LoaderCircle className="mixer-spin" size={18} /> Searching voices…</p>
              ) : voiceResults.length === 0 ? (
                <p>No voices found.</p>
              ) : voiceResults.map((voice) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={voice.id === voiceChannel.voiceId}
                  key={voice.id}
                  onClick={() => selectVoice(voice)}
                >
                  <Music2 size={20} />
                  <span><strong>{voice.name}</strong><small>{voice.category}</small></span>
                  {voice.id === voiceChannel.voiceId && <Check size={18} />}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
