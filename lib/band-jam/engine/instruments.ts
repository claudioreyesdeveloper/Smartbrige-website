import {
  buildRegionIndex,
  createRoundRobinSelector,
  parseSfz,
  playbackRateFor,
  regionGain,
  selectRegion,
  type SfzRegionIndex,
} from "@/lib/band-jam/engine/sfz"
import { SampleBank } from "@/lib/band-jam/engine/sample-bank"
import {
  megaVoiceMapFor,
  velocityForArticulation,
} from "@/lib/band-jam/engine/megavoice-map"
import type { RegionSelector } from "@/lib/band-jam/engine/player"
import {
  FX_PITCH_MIN,
  type Articulation,
  type SfzInstrument,
} from "@/lib/band-jam/engine/types"

/**
 * Binds an instrument ROLE ("bass") to a concrete sample library, and hides
 * how that library expresses articulation behind one interface.
 *
 * Why this layer exists: the MIDI clips are Yamaha style data, so they speak
 * MegaVoice — velocity band selects articulation, notes above FX_PITCH_MIN are
 * fret noise rather than pitches. Other SFZ libraries (Karoryfer, Unreal) use
 * keyswitches instead. Swapping libraries is therefore an articulation remap,
 * not a sample swap. Parts ask for "dead" or "sustain"; the adapter resolves
 * it. See docs/jam-player-voice-engine.md section 6.5.
 */

export type InstrumentManifest = {
  instrumentId: string
  label: string
  sfzUrl: string
  sampleBaseUrl: string
  /** Per-sample source rates. NOT a constant: the drum kit is 44.1k, bass and
   *  guitar are 48k, and frame offsets are meaningless without the right one. */
  sourceSampleRates: Record<string, number>
  totalBytes?: number
  regionCount?: number
  sampleCount?: number
  /**
   * Whole-instrument level-matching gain, written by
   * scripts/band_jam_pilot/measure_instrument_loudness.py to correct the
   * measured loudness imbalance BETWEEN instruments (drums/bass/guitar/piano
   * sitting at different perceived volume). Linear multiplier, 1.0 =
   * unchanged. This is NOT a per-region/velocity-layer gain -- MegaVoice
   * articulation dynamics (dead/mute/sustain/fx all at different, intentional
   * levels) are untouched; this scales the whole instrument uniformly on top
   * of that. Absent/undefined means unmeasured -- treat as 1.0.
   */
  instrumentGain?: number
}

export type LoadedInstrument = {
  manifest: InstrumentManifest
  instrument: SfzInstrument
  index: SfzRegionIndex
  bank: SampleBank
  selector: RegionSelector
  /** manifest.instrumentGain defaulted to 1.0; read this, not manifest.instrumentGain directly. */
  instrumentGain: number
}

/** Where build_web_samples.py writes its output. */
export const INSTRUMENTS_BASE = "/jam-player/instruments"

/** Role -> built instrument id. The one place a sound source is chosen. */
/**
 * ARTICULATION LAYOUT MATTERS MORE THAN TONE when choosing a MegaVoice default.
 *
 * MegaVoice velocity bands are not shared across voices. SolidGuitar1 and
 * CleanGuitar put SLAP at velocity 41-60; SolidGuitar2, SteelGuitar and
 * NylonGuitar put OPEN HARD there. Nearly every extracted clip was written
 * for the second layout, so defaulting to SolidGuitar1 made a large slice of
 * ordinary comping velocities fire slaps instead of strums.
 *
 * Default electric is now Karoryfer Emilyguitar (`guitar-emily`): a real DI
 * flatwound sample set (CC0). Velocity means loudness there, so MegaVoice
 * articulation bands map coarsely onto soft/hard layers — still far better
 * than Yamaha SolidGuitar's synthetic tone. Ballad/country stay on
 * `guitar-steel`. SolidGuitar2 remains available as a fallback id.
 */
export const ROLE_INSTRUMENTS: Record<string, string> = {
  // PowerKit2 replaces the much larger SMDrums bundle as the acoustic
  // default. Rock and swing-jazz retain their deliberate kit overrides.
  drums: "drums-power2",
  bass: "bass-electric",
  guitar: "guitar-emily",
  keys: "piano-grand",
  solo: "guitar-emily",
}

/**
 * Per-style instrument overrides.
 *
 * The sound source is part of the style, not a global choice: a funk or R&B
 * band plays a Rhodes, a ballad plays a grand. Anything absent here falls back
 * to ROLE_INSTRUMENTS.
 */
export const STYLE_ROLE_INSTRUMENTS: Record<
  string,
  Partial<Record<string, string>>
> = {
  // The curated Classic Funk generated performances were authored for the
  // Yamaha Mega SolidGuitar2 velocity/articulation layout. Emilyguitar treats
  // those velocities as ordinary dynamics and loses the intended mutes and
  // hard/open attacks, so Funk deliberately returns to SolidGuitar2.
  // PowerKit2 is the global acoustic default. These entries remain explicit
  // so the curated launch styles document their intended sound source.
  funk: { drums: "drums-power2", guitar: "guitar-solid2", keys: "keys-suitcase-ep" },
  pop: { drums: "drums-power2", guitar: "guitar-steel", keys: "keys-suitcase-ep" },
  rnb: { keys: "keys-suitcase-ep" },
  // Acoustic steel-string. NOTE: the effect presets must drop the amp/cabinet
  // for these styles -- an acoustic guitar through a 4x12 sounds as wrong as
  // a grand piano would.
  // Rock uses Emilyguitar through the rock amp rig, NOT DistortionGtr.
  //
  // DistortionGtr only covers FX keys 85-101 (8 regions); SolidGuitar2 covers
  // 85-127 (34). Our style clips fire strum/fret-noise notes up to 118, so on
  // DistortionGtr a large share of the articulation simply has no sample.
  // Distortion character comes from the amp sim in effects-presets instead.
  ballad: { drums: "drums-brushkit", guitar: "guitar-steel" },
  country: { guitar: "guitar-steel" },
  // Drum kits from the PSR-S900 Kontakt library (not PowerKit1).
  rock: { drums: "drums-rockkit" },
  "swing-jazz": { drums: "drums-brushkit" },
}

/**
 * Rock is deliberately double-tracked at playback: the organic Emily DI and
 * the articulation-complete SolidGuitar2 receive the same performance through
 * independent amp chains, then sit at opposite sides of the stereo field.
 * Keeping this recipe here makes the sound-source choice as explicit and
 * testable as the single-instrument style overrides above.
 */
export const ROCK_GUITAR_LAYERS = [
  { id: "guitar-emily", layerId: "emily-left", pan: -0.88, trim: 0.42 },
  { id: "guitar-solid2", layerId: "solid2-right", pan: 0.88, trim: 0.42 },
] as const

export function instrumentForRole(role: string, styleId?: string): string | undefined {
  if (styleId) {
    const override = STYLE_ROLE_INSTRUMENTS[styleId]?.[role]
    if (override) return override
  }
  return ROLE_INSTRUMENTS[role]
}

// ---------------------------------------------------------------------------
// Articulation adapters
// ---------------------------------------------------------------------------

export type ArticulationAdapter = {
  /**
   * Resolve an articulation request to the (note, velocity) pair that produces
   * it on this library. Returns null when the library cannot express it.
   */
  resolve(
    articulation: Articulation,
    note: number,
    baseVelocity: number,
  ): { note: number; velocity: number } | null
  /** True when this note is non-pitched material that must not be transposed. */
  isFxNote(note: number): boolean
}

/** Our library-independent vocabulary -> Yamaha's own articulation names. */
const ARTICULATION_ALIASES: Record<Articulation, string[]> = {
  sustain: ["open soft", "open", "open med"],
  mute: ["mute", "dead hard"],
  dead: ["dead", "dead soft"],
  slide: ["slide"],
  harmonic: ["pick harmonics", "harmonics"],
  fx: [],
}

/**
 * Yamaha MegaVoice: velocity selects ARTICULATION, note range selects noise
 * layers. Band edges come from the generated Yamaha map, not from guesswork —
 * two of the values previously hardcoded here were off by a whole band
 * (velocity 105 is `hammer`, not `slide`; 120 is `slide`, not `harmonics`),
 * and bass voices have an entirely different band layout from guitars.
 *
 * NOTE: never reach for this to change loudness. Moving velocity moves
 * articulation — a "quieter" note becomes a dead note. Level belongs to the
 * part gain in BandPlayer.
 */
export function megaVoiceAdapterFor(voiceName: string): ArticulationAdapter {
  const map = megaVoiceMapFor(voiceName)
  return {
    resolve(articulation, note, baseVelocity) {
      // Noise layers are addressed by NOTE, not velocity — leave them alone.
      if (note > FX_PITCH_MIN) return { note, velocity: baseVelocity }
      if (articulation === "fx") return null
      if (!map) return { note, velocity: baseVelocity }
      for (const name of ARTICULATION_ALIASES[articulation] ?? []) {
        const v = velocityForArticulation(map, name)
        if (v !== null) return { note, velocity: v }
      }
      // This voice genuinely lacks the articulation (basses have no "mute"
      // or "slide"). Better to play it plainly than to pick a wrong band.
      return { note, velocity: baseVelocity }
    },
    isFxNote(note) {
      return note > FX_PITCH_MIN
    },
  }
}

/** Default adapter for the voice this engine currently plays. */
export const megaVoiceAdapter = megaVoiceAdapterFor("SolidGuitar1")

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export async function loadInstrument(
  ctx: BaseAudioContext,
  instrumentId: string,
  opts: {
    baseUrl?: string
    onProgress?: (loaded: number, total: number) => void
    fetchImpl?: typeof fetch
  } = {},
): Promise<LoadedInstrument> {
  const doFetch = opts.fetchImpl ?? fetch
  const base = `${opts.baseUrl ?? INSTRUMENTS_BASE}/${instrumentId}`

  const manifestRes = await doFetch(`${base}/manifest.json`)
  if (!manifestRes.ok) {
    throw new Error(
      `Instrument manifest missing for "${instrumentId}" (${manifestRes.status}). ` +
        `Run scripts/band_jam_pilot/build_web_samples.py.`,
    )
  }
  const manifest = (await manifestRes.json()) as InstrumentManifest

  const sfzRes = await doFetch(absolutise(manifest.sfzUrl, base))
  if (!sfzRes.ok) {
    throw new Error(`SFZ missing for "${instrumentId}" (${sfzRes.status})`)
  }
  const sfzText = await sfzRes.text()

  const instrument = parseSfz(
    sfzText,
    absolutise(manifest.sampleBaseUrl, base),
    manifest.instrumentId,
    manifest.label,
  )
  const index = buildRegionIndex(instrument)
  const chooseRegion = createRoundRobinSelector(index)

  const bank = new SampleBank(ctx, {
    sourceSampleRates: manifest.sourceSampleRates,
    onProgress: opts.onProgress,
    fetchImpl: opts.fetchImpl,
  })
  await bank.loadInstrument(instrument)

  const selector: RegionSelector = {
    selectRegion: chooseRegion,
    regionGain,
    playbackRateFor,
  }

  const instrumentGain = manifest.instrumentGain ?? 1.0

  return { manifest, instrument, index, bank, selector, instrumentGain }
}

/**
 * Load the instruments a style needs. Bass and drums first so playback can
 * start before the 11 MB guitar finishes.
 */
export async function loadInstrumentsForRoles(
  ctx: BaseAudioContext,
  roles: string[],
  opts: {
    baseUrl?: string
    /** Applies STYLE_ROLE_INSTRUMENTS overrides, e.g. funk keys -> Suitcase EP. */
    styleId?: string
    onProgress?: (instrumentId: string, loaded: number, total: number) => void
    fetchImpl?: typeof fetch
  } = {},
): Promise<Map<string, LoadedInstrument>> {
  const priority = ["drums", "bass", "keys", "guitar", "solo"]
  const ordered = [...new Set(roles)].sort(
    (a, b) => priority.indexOf(a) - priority.indexOf(b),
  )

  const out = new Map<string, LoadedInstrument>()
  const byInstrument = new Map<string, LoadedInstrument>()

  for (const role of ordered) {
    const instrumentId = instrumentForRole(role, opts.styleId)
    if (!instrumentId) continue
    // Guitar and solo share one library; load it once.
    const cached = byInstrument.get(instrumentId)
    if (cached) {
      out.set(role, cached)
      continue
    }
    const loaded = await loadInstrument(ctx, instrumentId, {
      baseUrl: opts.baseUrl,
      fetchImpl: opts.fetchImpl,
      onProgress: (l, t) => opts.onProgress?.(instrumentId, l, t),
    })
    byInstrument.set(instrumentId, loaded)
    out.set(role, loaded)
  }
  return out
}

function absolutise(url: string, base: string): string {
  if (/^https?:\/\//.test(url) || url.startsWith("/")) return url
  return `${base}/${url}`
}
