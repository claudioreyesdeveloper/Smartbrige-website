import type { BandStyle } from "@/lib/band-jam/types"

/**
 * Pilot styles — clip IDs from SmartBridge midi_clips.
 * SFZ names match prototype/converted PSR-S900 instruments.
 */
export const PILOT_STYLES: BandStyle[] = [
  {
    id: "funk",
    name: "Funk",
    tempoDefault: 116,
    tempoMin: 96,
    tempoMax: 132,
    parts: {
      drums: {
        sfz: "014_StandardKit1_gm.sfz",
        gain: 1.0,
        harmonic: false,
        slots: {
          intro: { clipId: 55139 },
          verse: { clipId: 55142 },
          chorus: { clipId: 55148 },
          bridge: { clipId: 55153 },
        },
        fills: {
          atSectionEnd: true,
          minSectionBars: 4,
          pool: [55156, 1781, 1782, 1783],
        },
      },
      bass: {
        sfz: "024_ElectricBass MegaVoice.sfz",
        gain: 0.95,
        harmonic: true,
        register: [29, 43],
        slots: {
          intro: { clipId: 232595 },
          verse: { clipId: 232610 },
          chorus: { clipId: 232567 },
          bridge: { clipId: 232564 },
        },
      },
      guitar: {
        sfz: "077_SolidGuitar1 MegaVoice.sfz",
        gain: 0.6,
        harmonic: true,
        register: [45, 83],
        // Pilot: one guitar clip reused for the whole progression.
        reuseClipId: 4025,
        slots: {
          intro: { clipId: 4025 },
          verse: { clipId: 4025 },
          chorus: { clipId: 4025 },
          bridge: { clipId: 4025 },
        },
      },
      solo: {
        sfz: "077_SolidGuitar1 MegaVoice.sfz",
        gain: 0.7,
        harmonic: true,
        register: [52, 83],
        reuseClipId: 4284,
        slots: {
          chorus: { clipId: 4284 },
        },
      },
    },
  },
  {
    id: "pop",
    name: "Pop",
    tempoDefault: 96,
    tempoMin: 76,
    tempoMax: 120,
    parts: {
      drums: {
        sfz: "014_StandardKit1_gm.sfz",
        gain: 1.0,
        harmonic: false,
        slots: {
          intro: { clipId: 1198 },
          verse: { clipId: 1202 },
          chorus: { clipId: 1151 },
          bridge: { clipId: 1147 },
        },
      },
      bass: {
        sfz: "024_ElectricBass MegaVoice.sfz",
        gain: 0.95,
        harmonic: true,
        register: [28, 48],
        slots: {
          intro: { clipId: 232249 },
          verse: { clipId: 232252 },
          chorus: { clipId: 232262 },
        },
      },
      guitar: {
        sfz: "077_SolidGuitar1 MegaVoice.sfz",
        gain: 0.55,
        harmonic: true,
        register: [45, 76],
        reuseClipId: 3904,
        slots: {
          intro: { clipId: 3904 },
          verse: { clipId: 3904 },
          chorus: { clipId: 3904 },
        },
      },
    },
  },
  {
    id: "ballad",
    name: "Ballad",
    tempoDefault: 72,
    tempoMin: 60,
    tempoMax: 88,
    parts: {
      drums: {
        sfz: "014_StandardKit1_gm.sfz",
        gain: 0.9,
        harmonic: false,
        slots: {
          verse: { clipId: 101591 },
          chorus: { clipId: 101533 },
        },
      },
      bass: {
        sfz: "024_ElectricBass MegaVoice.sfz",
        gain: 0.9,
        harmonic: true,
        register: [28, 48],
        slots: {
          intro: { clipId: 233072 },
          verse: { clipId: 233076 },
          chorus: { clipId: 233080 },
        },
      },
      guitar: {
        sfz: "077_SolidGuitar1 MegaVoice.sfz",
        gain: 0.5,
        harmonic: true,
        register: [45, 76],
        reuseClipId: 3926,
        slots: {
          verse: { clipId: 3926 },
          chorus: { clipId: 3926 },
        },
      },
    },
  },
]
