import type {
  MixerChannel,
  MixerWorkspaceAction,
  MixerWorkspaceState,
} from "./types"

export const STYLE_PART_LABELS = [
  "Right 1",
  "Right 2",
  "Right 3",
  "Left",
  "Multi Pad 1",
  "Multi Pad 2",
  "Multi Pad 3",
  "Multi Pad 4",
  "Rhythm 1",
  "Rhythm 2",
  "Bass",
  "Chord 1",
  "Chord 2",
  "Pad",
  "Phrase 1",
  "Phrase 2",
] as const

export const SONG_PART_LABELS = Array.from(
  { length: 16 },
  (_, index) => `Song ${index + 1}`,
)

const clampMidi = (value: number) => Math.max(0, Math.min(127, Math.round(value)))

export function createUnknownMixerChannels(): MixerChannel[] {
  return [...STYLE_PART_LABELS, ...SONG_PART_LABELS].map((label, index) => ({
    part: index + 1,
    label,
    voiceId: "",
    voiceName: "Unknown",
    volume: 100,
    pan: 64,
    reverb: 0,
    chorus: 0,
    mute: false,
    known: false,
  }))
}

export const initialMixerWorkspaceState: MixerWorkspaceState = {
  page: "style",
  channels: createUnknownMixerChannels(),
  selectedVoicePart: null,
}

export function mixerWorkspaceReducer(
  state: MixerWorkspaceState,
  action: MixerWorkspaceAction,
): MixerWorkspaceState {
  switch (action.type) {
    case "select-page":
      return { ...state, page: action.page, selectedVoicePart: null }
    case "replace-channels":
      return { ...state, channels: action.channels.map((channel) => ({ ...channel })) }
    case "change-level":
      return {
        ...state,
        channels: state.channels.map((channel) =>
          channel.part === action.part
            ? { ...channel, [action.field]: clampMidi(action.value) }
            : channel,
        ),
      }
    case "toggle-mute":
      return {
        ...state,
        channels: state.channels.map((channel) =>
          channel.part === action.part ? { ...channel, mute: !channel.mute } : channel,
        ),
      }
    case "open-voice":
      return { ...state, selectedVoicePart: action.part }
    case "close-voice":
      return { ...state, selectedVoicePart: null }
    case "select-voice":
      return {
        ...state,
        selectedVoicePart: null,
        channels: state.channels.map((channel) =>
          channel.part === action.part
            ? {
                ...channel,
                voiceId: action.voice.id,
                voiceName: action.voice.name,
                known: true,
              }
            : channel,
        ),
      }
  }
}

export function channelsForPage(state: MixerWorkspaceState): MixerChannel[] {
  return state.channels.filter((channel) =>
    state.page === "style" ? channel.part <= 16 : channel.part >= 17,
  )
}

export function supportsGenosMixer(userAgent: string, isSecureContext: boolean): boolean {
  const desktop = !/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
  const chrome = /Chrome\//.test(userAgent) && !/OPR\//.test(userAgent)
  const edge = /Edg\//.test(userAgent)
  return desktop && (chrome || edge) && isSecureContext
}
