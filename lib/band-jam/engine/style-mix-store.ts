import type { UserEqSettings } from "@/lib/band-jam/engine/effects"
import type { BandPart, PartMixState } from "@/lib/band-jam/engine/types"

// v2 starts with the source-headroom rebuild (guitars -6 dB, keys -3 dB).
// Old fader balances were made against louder samples and would double-apply
// their correction, so they must not silently carry into the new gain stage.
const STORAGE_KEY = "smartbridge.jam-player.style-mix.v3"
const LEGACY_STORAGE_KEY = "smartbridge.jam-player.style-mix.v2"
const PARTS: BandPart[] = ["drums", "bass", "guitar", "keys", "solo"]

export type StyleMixerState = {
  mix: Record<BandPart, PartMixState>
  eq: Record<BandPart, UserEqSettings>
  sends: Record<BandPart, number>
  pan: Record<BandPart, number>
  room: number
}

type StoredChannel = {
  volume?: number
  eq?: Partial<UserEqSettings>
  reverbSend?: number
  pan?: number
}

type StoredStyle = {
  channels?: Partial<Record<BandPart, StoredChannel>>
  room?: number
}

// Older builds stored only a number per part. Keep reading those settings so
// an existing user's guitar balance is not lost when the full mixer arrives.
type LegacyStyle = Partial<Record<BandPart, number>>
type StoredMixes = Record<string, StoredStyle | LegacyStyle>

function mixKey(styleId: string, variation: number): string {
  const safeVariation = Math.max(0, Math.min(3, Math.floor(variation)))
  return `${styleId}::${safeVariation}`
}

function canStore(): boolean {
  return typeof window !== "undefined" && !!window.localStorage
}

function readStore(): StoredMixes {
  if (!canStore()) return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")
    return parsed && typeof parsed === "object" ? (parsed as StoredMixes) : {}
  } catch {
    return {}
  }
}

function readLegacyStyle(styleId: string): StoredStyle | LegacyStyle | undefined {
  if (!canStore()) return undefined
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) ?? "{}")
    return parsed && typeof parsed === "object"
      ? (parsed as StoredMixes)[styleId]
      : undefined
  } catch {
    return undefined
  }
}

function clamp(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  return Math.max(min, Math.min(max, value))
}

const level = (value: unknown) => clamp(value, 0, 1)
const db = (value: unknown) => clamp(value, -12, 12)
const panorama = (value: unknown) => clamp(value, -1, 1)

function storedChannel(style: StoredStyle | LegacyStyle, part: BandPart): StoredChannel {
  if ("channels" in style) return style.channels?.[part] ?? {}
  const legacyVolume = (style as LegacyStyle)[part]
  return typeof legacyVolume === "number" ? { volume: legacyVolume } : {}
}

export function loadStyleMixer(
  styleId: string,
  variation: number,
  fallback: StyleMixerState,
): StyleMixerState {
  // A mix saved by the previous per-style implementation becomes Variation A.
  // B-D intentionally start from the curated defaults until explicitly saved.
  const saved = readStore()[mixKey(styleId, variation)]
    ?? (variation === 0 ? readLegacyStyle(styleId) : undefined)
  if (!saved) return fallback

  const next: StyleMixerState = {
    mix: { ...fallback.mix },
    eq: { ...fallback.eq },
    sends: { ...fallback.sends },
    pan: { ...fallback.pan },
    room: "room" in saved ? (level(saved.room) ?? fallback.room) : fallback.room,
  }

  for (const part of PARTS) {
    const channel = storedChannel(saved, part)
    const fallbackEq = fallback.eq[part]
    next.mix[part] = {
      ...fallback.mix[part],
      volume: level(channel.volume) ?? fallback.mix[part].volume,
      // Mute, solo and audition are performance gestures, never saved.
      muted: fallback.mix[part].muted,
    }
    next.eq[part] = {
      low: db(channel.eq?.low) ?? fallbackEq.low,
      mid: db(channel.eq?.mid) ?? fallbackEq.mid,
      high: db(channel.eq?.high) ?? fallbackEq.high,
    }
    next.sends[part] = level(channel.reverbSend) ?? fallback.sends[part]
    next.pan[part] = panorama(channel.pan) ?? fallback.pan[part]
  }
  return next
}

/** Save only when the user presses the mixer's dedicated Save button. */
export function saveStyleMixer(
  styleId: string,
  variation: number,
  state: StyleMixerState,
): void {
  if (!canStore() || !styleId) return
  const store = readStore()
  store[mixKey(styleId, variation)] = {
    room: level(state.room) ?? 0,
    channels: Object.fromEntries(
      PARTS.map((part) => [
        part,
        {
          volume: level(state.mix[part]?.volume) ?? 1,
          eq: {
            low: db(state.eq[part]?.low) ?? 0,
            mid: db(state.eq[part]?.mid) ?? 0,
            high: db(state.eq[part]?.high) ?? 0,
          },
          reverbSend: level(state.sends[part]) ?? 0,
          pan: panorama(state.pan[part]) ?? 0,
        },
      ]),
    ),
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

/** Compatibility helpers for older callers and focused volume tests. */
export function loadStyleMix(
  styleId: string,
  fallback: Record<BandPart, PartMixState>,
  variation = 0,
): Record<BandPart, PartMixState> {
  const flatEq = Object.fromEntries(PARTS.map((part) => [part, { low: 0, mid: 0, high: 0 }])) as Record<BandPart, UserEqSettings>
  return loadStyleMixer(styleId, variation, {
    mix: fallback,
    eq: flatEq,
    sends: Object.fromEntries(PARTS.map((part) => [part, 0])) as Record<BandPart, number>,
    pan: Object.fromEntries(PARTS.map((part) => [part, 0])) as Record<BandPart, number>,
    room: 0,
  }).mix
}

export function saveStyleMix(
  styleId: string,
  mix: Record<BandPart, PartMixState>,
  variation = 0,
): void {
  const key = mixKey(styleId, variation)
  const existing = readStore()[key]
  const channels = Object.fromEntries(
    PARTS.map((part) => {
      const prior = existing ? storedChannel(existing, part) : {}
      return [part, { ...prior, volume: level(mix[part]?.volume) ?? 1 }]
    }),
  ) as Record<BandPart, StoredChannel>
  if (!canStore() || !styleId) return
  const store = readStore()
  store[key] = { ...(existing && "channels" in existing ? existing : {}), channels }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function clearStyleMix(styleId: string, variation = 0): void {
  if (!canStore() || !styleId) return
  const store = readStore()
  delete store[mixKey(styleId, variation)]
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  // Resetting Variation A must also retire a pre-v3 per-style mix; otherwise
  // the legacy value would unexpectedly return after the next page load.
  if (variation === 0) {
    try {
      const legacy = JSON.parse(
        window.localStorage.getItem(LEGACY_STORAGE_KEY) ?? "{}",
      ) as StoredMixes
      if (legacy && typeof legacy === "object") {
        delete legacy[styleId]
        window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy))
      }
    } catch {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
  }
}

export const STYLE_MIX_STORAGE_KEY = STORAGE_KEY
