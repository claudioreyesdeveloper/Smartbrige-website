"use client"

import {
  FolderOpen,
  LoaderCircle,
  Music2,
  RefreshCw,
  Save,
  Search,
  TriangleAlert,
  X,
} from "lucide-react"
import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import {
  channelsForPage,
  initialMixerWorkspaceState,
  mixerWorkspaceReducer,
  supportsGenosMixer,
} from "./state"
import { downloadMixFile, readMixFile } from "./mix-file"
import { createProductionGenosMixerAdapters } from "./production"
import { GlobalKeyboardStatus } from "@/components/keyboard/global-keyboard-status"
import type {
  GenosMixerAdapters,
  MixerChannel,
  MixerConnectionState,
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
  const [status, setStatus] = useState("Refresh from the keyboard, or load a mix file.")
  const [error, setError] = useState("")
  const [voiceQuery, setVoiceQuery] = useState("")
  const [voiceResults, setVoiceResults] = useState<readonly MixerVoice[]>([])
  const [voiceLoading, setVoiceLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      setStatus("Unsaved mixer changes")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mixer control failed.")
    }
  }

  const toggleMute = (channel: MixerChannel) => {
    const next = { ...channel, mute: !channel.mute }
    try {
      adapters.device.updateChannel(next, "mute")
      dispatch({ type: "toggle-mute", part: channel.part })
      setStatus("Unsaved mixer changes")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mixer mute failed.")
    }
  }

  const refresh = async () => {
    setError("")
    try {
      const channels = await adapters.device.refresh()
      dispatch({ type: "replace-channels", channels })
      setStatus("Mixer refreshed from keyboard")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mixer refresh failed.")
    }
  }

  const saveMix = () => {
    setError("")
    try {
      downloadMixFile(state.channels)
      setStatus("Mix saved to file")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mix could not be saved.")
      setStatus("Save failed")
    }
  }

  const loadMixFromPicker = async (file: File | null) => {
    if (!file) return
    setError("")
    setStatus("Loading mix…")
    try {
      const channels = await readMixFile(file)
      dispatch({ type: "replace-channels", channels })
      for (const channel of channels) {
        if (!channel.known) continue
        try {
          adapters.device.updateChannel(channel, "volume")
          adapters.device.updateChannel(channel, "pan")
          adapters.device.updateChannel(channel, "reverb")
          adapters.device.updateChannel(channel, "chorus")
          adapters.device.updateChannel(channel, "mute")
          if (channel.voiceId) adapters.device.updateChannel(channel, "voice")
        } catch {
          // Keep UI values even if the keyboard rejects a field.
        }
      }
      setStatus(`Mix loaded: ${file.name}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mix could not be loaded.")
      setStatus("Load failed")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
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
      setStatus("Unsaved mixer changes")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Voice selection failed.")
    }
  }

  return (
    <div className="genos-mixer">
      <GlobalKeyboardStatus />
      <section className="mixer-command-bar" aria-label="Mixer status and files">
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
          <button
            type="button"
            className="mixer-button"
            onClick={refresh}
            disabled={connection.phase === "refreshing"}
          >
            {connection.phase === "refreshing"
              ? <LoaderCircle className="mixer-spin" size={16} />
              : <RefreshCw size={16} />}
            Refresh
          </button>
          <button type="button" className="mixer-button is-primary" onClick={saveMix}>
            <Save size={16} /> Save Mix
          </button>
          <button
            type="button"
            className="mixer-button"
            onClick={() => fileInputRef.current?.click()}
          >
            <FolderOpen size={16} /> Load Mix
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".tyrosmix,application/json"
            className="visually-hidden"
            aria-label="Load mix file"
            onChange={(event) => void loadMixFromPicker(event.target.files?.[0] ?? null)}
          />
        </div>
      </section>

      <div className="mixer-feedback-row">
        <p role="status">{status}</p>
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

      <div
        className="mixer-console"
        role="region"
        aria-label={state.page === "style" ? "Style channels" : "Song channels"}
      >
        <div className="mixer-console-scroll">
          {visibleChannels.map((channel) => (
            <article
              key={channel.part}
              className={`mixer-channel${channel.mute ? " is-muted" : ""}${channel.known ? "" : " is-unknown"}`}
            >
              <header>
                <strong>{channel.label}</strong>
                <span>Ch {channel.part}</span>
              </header>
              <button
                type="button"
                className="mixer-voice-button"
                onClick={() => dispatch({ type: "open-voice", part: channel.part })}
              >
                <Music2 size={16} aria-hidden="true" />
                <span>{channel.voiceName || "Unknown"}</span>
              </button>
              {(Object.keys(levelLabels) as LevelField[]).map((field) => (
                <label key={field} className="mixer-fader">
                  <span>{levelLabels[field]}</span>
                  <input
                    type="range"
                    min={0}
                    max={127}
                    value={channel[field]}
                    aria-label={`${channel.label} ${levelLabels[field]}`}
                    onChange={(event) =>
                      changeLevel(channel, field, Number(event.target.value))
                    }
                  />
                  <strong>{channel[field]}</strong>
                </label>
              ))}
              <button
                type="button"
                className={`mixer-mute${channel.mute ? " is-on" : ""}`}
                aria-pressed={channel.mute}
                onClick={() => toggleMute(channel)}
              >
                Mute
              </button>
            </article>
          ))}
        </div>
      </div>

      {voiceChannel && (
        <div className="mixer-voice-drawer" role="dialog" aria-label="Voice search">
          <header>
            <div>
              <span>Voice for {voiceChannel.label}</span>
              <strong>{voiceChannel.voiceName}</strong>
            </div>
            <button type="button" onClick={() => dispatch({ type: "close-voice" })}>
              <X size={16} /> Close
            </button>
          </header>
          <label className="mixer-voice-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={voiceQuery}
              placeholder="Search voices"
              aria-label="Search voices"
              onChange={(event) => setVoiceQuery(event.target.value)}
            />
          </label>
          <ul>
            {voiceLoading && <li className="mixer-muted">Searching…</li>}
            {!voiceLoading && voiceResults.length === 0 && (
              <li className="mixer-muted">No voices match.</li>
            )}
            {voiceResults.map((voice) => (
              <li key={voice.id}>
                <button type="button" onClick={() => selectVoice(voice)}>
                  <strong>{voice.name}</strong>
                  <small>{voice.category}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
