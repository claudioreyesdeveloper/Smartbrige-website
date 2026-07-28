/**
 * Yamaha MegaVoice velocity maps — GENERATED, do not hand-edit.
 *
 * Source: Yamaha Genos 2 Data List, "MegaVoice Map" table.
 * Per Claudio, the Genos MegaVoice layout applies to the PSR-S900 for the
 * voices the S900 supports (ElectricBass, SolidGuitar1/2, JazzGuitar,
 * NylonGuitar, SteelGuitar), which is what this engine plays.
 *
 * Two things this encodes that guesswork got wrong:
 *  - Guitars have EIGHT velocity bands; basses have three or four, with
 *    entirely different boundaries. They cannot share one mapping.
 *  - The band edges are exact. Velocity 105 is `hammer`, not `slide`;
 *    120 is `slide`, not `harmonics`.
 *
 * Note-range layers (same document, whose Drum/SFX Kit table fixes the
 * convention as MIDI 0 = C-1, MIDI 60 = C4):
 *    pitched   <= B5  (83)
 *    strum/SE  >= C6  (84)
 *    fret noise>= C8  (108)
 */

export type MegaVoiceBand = {
  lo: number
  hi: number
  articulation: string
}

export type MegaVoiceMap = {
  voice: string
  msb: number
  lsb: number
  pc0: number
  velocityBands: MegaVoiceBand[]
  noiseLayers: string[]
}

/** B5. Notes above this are noise layers, never pitched material. */
export const MEGAVOICE_PITCHED_MAX = 83
/** C6. Strum noise / SE begins here. */
export const MEGAVOICE_STRUM_MIN = 84
/** C8. Fret noise begins here. */
export const MEGAVOICE_FRET_NOISE_MIN = 108

export const MEGAVOICE_MAPS: MegaVoiceMap[] = [
  {
    voice: "NylonGuitar",
    msb: 8, lsb: 0, pc0: 0,
    velocityBands: [
      { lo: 1, hi: 20, articulation: "open soft" },
      { lo: 21, hi: 40, articulation: "open med" },
      { lo: 41, hi: 60, articulation: "open hard" },
      { lo: 61, hi: 75, articulation: "dead" },
      { lo: 76, hi: 90, articulation: "mute" },
      { lo: 91, hi: 105, articulation: "hammer" },
      { lo: 106, hi: 120, articulation: "slide" },
      { lo: 121, hi: 127, articulation: "harmonics" },
    ],
    noiseLayers: ["strum noise", "fret noise"],
  },
  {
    voice: "SteelGuitar",
    msb: 8, lsb: 0, pc0: 1,
    velocityBands: [
      { lo: 1, hi: 20, articulation: "open soft" },
      { lo: 21, hi: 40, articulation: "open med" },
      { lo: 41, hi: 60, articulation: "open hard" },
      { lo: 61, hi: 75, articulation: "dead" },
      { lo: 76, hi: 90, articulation: "mute" },
      { lo: 91, hi: 105, articulation: "hammer" },
      { lo: 106, hi: 120, articulation: "slide" },
      { lo: 121, hi: 127, articulation: "harmonics" },
    ],
    noiseLayers: ["strum noise", "fret noise"],
  },
  {
    voice: "CleanGuitar",
    msb: 8, lsb: 0, pc0: 3,
    velocityBands: [
      { lo: 1, hi: 20, articulation: "open soft" },
      { lo: 21, hi: 40, articulation: "open hard" },
      { lo: 41, hi: 60, articulation: "slap" },
      { lo: 61, hi: 75, articulation: "dead" },
      { lo: 76, hi: 90, articulation: "mute" },
      { lo: 91, hi: 105, articulation: "hammer" },
      { lo: 106, hi: 120, articulation: "slide" },
      { lo: 121, hi: 127, articulation: "pick harmonics" },
    ],
    noiseLayers: ["strum noise", "fret noise"],
  },
  {
    voice: "SolidGuitar1",
    msb: 8, lsb: 1, pc0: 3,
    velocityBands: [
      { lo: 1, hi: 20, articulation: "open soft" },
      { lo: 21, hi: 40, articulation: "open hard" },
      { lo: 41, hi: 60, articulation: "slap" },
      { lo: 61, hi: 75, articulation: "dead" },
      { lo: 76, hi: 90, articulation: "mute" },
      { lo: 91, hi: 105, articulation: "hammer" },
      { lo: 106, hi: 120, articulation: "slide" },
      { lo: 121, hi: 127, articulation: "pick harmonics" },
    ],
    noiseLayers: ["strum noise", "fret noise"],
  },
  {
    voice: "SolidGuitar2",
    msb: 8, lsb: 2, pc0: 3,
    velocityBands: [
      { lo: 1, hi: 20, articulation: "open soft" },
      { lo: 21, hi: 40, articulation: "open med" },
      { lo: 41, hi: 60, articulation: "open hard" },
      { lo: 61, hi: 75, articulation: "dead" },
      { lo: 76, hi: 90, articulation: "mute" },
      { lo: 91, hi: 105, articulation: "hammer" },
      { lo: 106, hi: 120, articulation: "slide" },
      { lo: 121, hi: 127, articulation: "pick harmonics" },
    ],
    noiseLayers: ["strum noise", "fret noise"],
  },
  {
    voice: "OverdriveGuitar",
    msb: 8, lsb: 0, pc0: 4,
    velocityBands: [
      { lo: 1, hi: 55, articulation: "open" },
      { lo: 56, hi: 120, articulation: "mute" },
      { lo: 121, hi: 127, articulation: "pick harmonics" },
    ],
    noiseLayers: ["SE"],
  },
  {
    voice: "DistortionGuitar",
    msb: 8, lsb: 0, pc0: 5,
    velocityBands: [
      { lo: 1, hi: 55, articulation: "open" },
      { lo: 56, hi: 120, articulation: "mute" },
      { lo: 121, hi: 127, articulation: "pick harmonics" },
    ],
    noiseLayers: ["SE"],
  },
  {
    voice: "JazzGuitar",
    msb: 8, lsb: 0, pc0: 6,
    velocityBands: [
      { lo: 1, hi: 20, articulation: "open soft" },
      { lo: 21, hi: 40, articulation: "open med" },
      { lo: 41, hi: 60, articulation: "open hard" },
      { lo: 61, hi: 75, articulation: "dead soft" },
      { lo: 76, hi: 90, articulation: "dead hard" },
      { lo: 91, hi: 105, articulation: "hammer" },
      { lo: 106, hi: 120, articulation: "slide" },
      { lo: 121, hi: 127, articulation: "pick harmonics" },
    ],
    noiseLayers: ["strum noise", "fret noise"],
  },
  {
    voice: "AcousticBass",
    msb: 8, lsb: 0, pc0: 16,
    velocityBands: [
      { lo: 1, hi: 60, articulation: "open soft" },
      { lo: 61, hi: 80, articulation: "open hard" },
      { lo: 81, hi: 120, articulation: "dead" },
      { lo: 121, hi: 127, articulation: "harmonics" },
    ],
    noiseLayers: ["SE"],
  },
  {
    voice: "ElectricBass",
    msb: 8, lsb: 0, pc0: 17,
    velocityBands: [
      { lo: 1, hi: 60, articulation: "open soft" },
      { lo: 61, hi: 80, articulation: "open hard" },
      { lo: 81, hi: 120, articulation: "dead" },
      { lo: 121, hi: 127, articulation: "slap" },
    ],
    noiseLayers: ["SE"],
  },
  {
    voice: "PickBass",
    msb: 8, lsb: 0, pc0: 18,
    velocityBands: [
      { lo: 1, hi: 40, articulation: "open" },
      { lo: 41, hi: 80, articulation: "mute" },
      { lo: 81, hi: 120, articulation: "dead" },
      { lo: 121, hi: 127, articulation: "harmonics" },
    ],
    noiseLayers: ["SE"],
  },
  {
    voice: "FretlessBass",
    msb: 8, lsb: 0, pc0: 19,
    velocityBands: [
      { lo: 1, hi: 80, articulation: "open" },
      { lo: 81, hi: 120, articulation: "dead" },
      { lo: 121, hi: 127, articulation: "harmonics" },
    ],
    noiseLayers: ["SE"],
  },
]

const BY_VOICE = new Map(MEGAVOICE_MAPS.map((m) => [m.voice, m]))

export function megaVoiceMapFor(voice: string): MegaVoiceMap | null {
  return BY_VOICE.get(voice) ?? null
}

/**
 * Velocity that triggers `articulation` on this voice: the centre of its
 * band, so small humanisation jitter cannot cross into the next articulation.
 * Returns null when the voice has no such articulation — basses have no
 * "mute" or "slide", and forcing one would silently pick the wrong sound.
 */
export function velocityForArticulation(
  map: MegaVoiceMap,
  articulation: string,
): number | null {
  const want = articulation.toLowerCase()
  const band =
    map.velocityBands.find((b) => b.articulation.toLowerCase() === want) ??
    map.velocityBands.find((b) => b.articulation.toLowerCase().startsWith(want))
  if (!band) return null
  return Math.round((band.lo + band.hi) / 2)
}

/** Articulation a given velocity actually produces on this voice. */
export function articulationForVelocity(
  map: MegaVoiceMap,
  velocity: number,
): string | null {
  const b = map.velocityBands.find((x) => velocity >= x.lo && velocity <= x.hi)
  return b ? b.articulation : null
}
