import type {
  DriveSettings,
  PartEffectSettings,
  StyleEffectPreset,
} from "@/lib/band-jam/engine/effects"
import type { BandPart } from "@/lib/band-jam/engine/types"

/**
 * Per-style mix treatment.
 *
 * Style-appropriate processing is a large part of what separates "raw samples"
 * from "produced": a ballad wants a long plate and gentle glue, a funk kit
 * wants a tight room and a fast compressor that lets the kick breathe.
 *
 * These are starting values chosen by ear-informed convention, not measured —
 * they are meant to be tuned. A second pass can derive per-VOICE settings from
 * `voice_insert_effects_sysex` in smartbridge.db (1,709 rows of Yamaha's own
 * insert-effect assignments per msb/lsb/prg), which is authoritative in a way
 * these defaults are not.
 *
 * Reverb sends are deliberately conservative. Drums get the least — a wet kick
 * is the fastest way to make a mix sound amateur.
 */

/**
 * Drum bus compression.
 *
 * ATTACK IS THE IMPORTANT NUMBER. This was 4 ms, which is fast enough to clamp
 * the stick transient itself — the compressor eats the very thing that makes a
 * drum sound like a drum, and the result reads as "squashed". At 18 ms the
 * transient passes through and the compressor only works on the body behind
 * it, which is what glues a kit without flattening it.
 *
 * Ratio and threshold eased too: the signal already meets a master compressor
 * and a limiter downstream, so three aggressive stages stack up fast.
 */
const DRUM_COMP = {
  threshold: -14,
  knee: 8,
  ratio: 2.5,
  attack: 0.018,
  release: 0.14,
}

/**
 * Bass compression — deliberately more assertive than the drums.
 *
 * Drums need their transient protected; bass needs CONSISTENCY, because an
 * uneven bass is what makes a mix feel unsteady. So: higher ratio, lower
 * threshold, and an attack slow enough (25 ms) to let the pluck through before
 * clamping the sustain behind it. Release is tied loosely to note length —
 * too fast and it pumps on every note, too slow and it never recovers.
 */
const BASS_COMP = {
  threshold: -22,
  knee: 4,
  ratio: 5,
  attack: 0.025,
  release: 0.16,
}

/**
 * Bass amp + cabinet.
 *
 * Only the mids are driven (`driveHighPassHz: 180`) so the fundamental stays
 * clean — clipping a low B makes it flabby and eats the bottom. The cabinet
 * low-passes at 3.5 kHz, roughly where a real 4x10 stops, with a bump at
 * 90 Hz for the cab's own resonance. Mix is modest: this is meant to add
 * grit and presence on a small speaker, not to sound like a distortion pedal.
 */
const BASS_AMP = {
  amount: 0.28,
  driveHighPassHz: 180,
  mix: 0.35,
  // Bass keeps the filter pair: a 4x12 guitar cab IR on a bass guitar
  // removes the fundamental entirely.
  cabinet: { lowPassHz: 3500, resonanceHz: 90, resonanceGain: 2.5 },
}

/**
 * Guitar compression — lighter than bass, firmer than drums.
 *
 * A comping guitar mostly needs its strums evened out so quiet chords still
 * register in the mix, without squashing the pick attack that gives each strum
 * its edge. 15 ms attack lets the pick through; ratio 3 is enough to level the
 * part without making it sound processed.
 */
const GUITAR_COMP = {
  threshold: -18,
  knee: 6,
  ratio: 3,
  attack: 0.015,
  release: 0.15,
}

// ---------------------------------------------------------------------------
// Layer 2: amp rigs
// ---------------------------------------------------------------------------

/**
 * Named guitar rigs. A channel is amplified ONLY by naming one of these.
 *
 * This exists because the previous design put `drive` on the default guitar
 * part, so every style inherited an amp whether or not it wanted one and the
 * acoustic styles only escaped by explicitly writing `drive: undefined`. Opt-out
 * is the wrong default for distortion. Now nothing is amplified implicitly.
 *
 * `amp` is a neural capture of a real amplifier (see lstm-amp.worklet.js);
 * `amount` is the fallback soft-clip used only if the worklet or the model
 * fails to load, tuned so the fallback is in the same ballpark rather than
 * wildly louder or cleaner.
 *
 * GAIN STAGING IS MEASURED, NOT GUESSED. `inputGain` is the amp's gain knob —
 * these networks were trained at one specific input level, so it changes
 * character, not just loudness. `outputGain` then brings every rig to the same
 * output RMS (0.18) against a reference chord, so switching styles does not
 * change how loud the guitar sits in the mix.
 *
 * Cabinet IRs are kept on every rig: measuring the captures' response to white
 * noise showed only 4-12 dB of roll-off by 8-15 kHz, where a real 4x12 drops
 * 30-40 dB. These are amp-only captures and still need a speaker.
 */
export const AMP_RIGS: Record<string, DriveSettings> = {
  /**
   * Blackface combo. Amp and speaker character, no dirt at all.
   *
   * Input gain is set from measured THD rather than by feel: at 1.6 the
   * Princeton reads 2.4% and at 1.0 it reads 1.1%, which is transparent. The
   * makeup then brings it back to the same output RMS as every other rig, so
   * dialling the gain down does not just make funk quieter.
   */
  clean: {
    amp: { model: "FenderPrinceton_clean", inputGain: 1.0, outputGain: 2.2 },
    amount: 0,
    mix: 1,
    cabinet: { ir: "cab-4x12-warm.ogg", lowPassHz: 6000, resonanceHz: 120, resonanceGain: 1.5 },
  },
  /**
   * Funk rhythm guitar — warm, not chimey.
   *
   * The first pass (Mesa clean + rock cab + big 2.8/5.5 kHz boosts) read as
   * overbright and high-pitched on SolidGuitar2 DI. Funk chicken-scratch
   * wants body and muted thunk, not hi-fi string air: Princeton + warm cab,
   * speaker rolled off hard so the top never gets fizzy.
   */
  funk: {
    amp: { model: "FenderPrinceton_clean", inputGain: 1.15, outputGain: 2.0 },
    amount: 0.15,
    mix: 1,
    cabinet: {
      ir: "cab-4x12-warm.ogg",
      lowPassHz: 4200,
      resonanceHz: 110,
      resonanceGain: 2.0,
    },
  },
  /** Mesa clean channel — brighter and stiffer than the Princeton. */
  chime: {
    amp: { model: "MesaBoogieMk2b_Clean", inputGain: 1.4, outputGain: 0.89 },
    amount: 0,
    mix: 1,
    cabinet: { ir: "cab-4x12-rock.ogg", lowPassHz: 6000, resonanceHz: 130, resonanceGain: 1.5 },
  },
  /** Edge-of-breakup. Cleans up when the part is quiet, growls when it digs in. */
  crunch: {
    amp: { model: "MesaBoogieMk2b_Crunch", inputGain: 2.0, outputGain: 0.73 },
    amount: 0.3,
    mix: 1,
    cabinet: { ir: "cab-4x12-warm.ogg", lowPassHz: 4800, resonanceHz: 150, resonanceGain: 3 },
  },
  /** Cranked Soldano. This is the rock sound. */
  "high-gain": {
    amp: { model: "Soldano_highGain", inputGain: 2.6, outputGain: 0.43 },
    amount: 0.6,
    mix: 1,
    cabinet: { ir: "cab-4x12-rock.ogg", lowPassHz: 4500, resonanceHz: 140, resonanceGain: 3 },
  },
}

/** Every amp model a rig can ask for — used to preload before chains are built. */
export function ampModelsInUse(): string[] {
  return [
    ...new Set(
      Object.values(AMP_RIGS)
        .map((r) => r.amp?.model)
        .filter((m): m is string => !!m),
    ),
  ]
}

/**
 * Keys compression — the lightest in the band, and deliberately so.
 *
 * An acoustic piano's dynamic range IS the instrument. Ratio 2 with a 30 ms
 * attack and a high threshold only catches the loudest chords, so the part
 * stays in the mix without flattening the difference between a soft comp and
 * an accent.
 *
 * Note there is no `drive` for keys: an amp simulator on an acoustic grand
 * sounds wrong. When an electric-piano sample set arrives, that changes —
 * a Rhodes through a little grit is exactly right.
 */
const KEYS_COMP = {
  threshold: -16,
  knee: 10,
  ratio: 2,
  attack: 0.03,
  release: 0.25,
}

/** Sensible baseline any style can start from. */
export const DEFAULT_PRESET: StyleEffectPreset = {
  id: "default",
  label: "Neutral room",
  reverb: { ir: "room-small.ogg", wet: 0.22, sendHighPassHz: 220 },
  master: {
    threshold: -12,
    knee: 6,
    ratio: 2.5,
    attack: 0.006,
    release: 0.18,
    gain: 0.9,
  },
  parts: {
    drums: {
      highPassHz: 35,
      peak: { freq: 3200, gain: 2, q: 0.9 },
      compressor: DRUM_COMP,
      reverbSend: 0.1,
      trim: 1,
    },
    bass: {
      // Bass needs no reverb send at all; it only blurs the low end.
      highPassHz: 32,
      lowShelf: { freq: 80, gain: 2.5 },
      peaks: [
        // The 250 Hz mud zone: cutting here is what lets the bass sit UNDER
        // the guitar and keys instead of fighting them for the same space.
        { freq: 250, gain: -3, q: 1.0 },
        // Definition/growl — where a bass becomes audible on a laptop speaker.
        { freq: 800, gain: 2, q: 1.1 },
        // String and finger noise; the part of the note you hear on a phone.
        { freq: 2400, gain: 2.5, q: 0.9 },
      ],
      drive: BASS_AMP,
      compressor: BASS_COMP,
      reverbSend: 0,
      trim: 0.95,
    },
    guitar: {
      // Nothing useful below 100 Hz on a guitar, and clearing it stops the
      // part competing with the bass for the same space.
      highPassHz: 100,
      peaks: [
        // Boxiness. The single most useful cut on a recorded guitar.
        { freq: 350, gain: -2.5, q: 1.0 },
        // Presence — where a comping guitar becomes audible against keys.
        { freq: 2000, gain: 2, q: 1.0 },
        // Pick attack and string definition.
        { freq: 4000, gain: 1.5, q: 0.9 },
      ],
      // NO `drive` here, deliberately. A rig is opt-in per instrument+style;
      // see AMP_RIGS and resolveChannelEffects.
      compressor: GUITAR_COMP,
      reverbSend: 0.2,
      trim: 0.9,
    },
    keys: {
      // A grand piano genuinely uses its bottom octave, so this sits far lower
      // than the guitar's — just enough to clear rumble.
      highPassHz: 45,
      peaks: [
        // Piano mud, the region that makes a comping part sound cloudy.
        { freq: 320, gain: -2, q: 1.1 },
        // Hammer definition; keeps the part articulate under a busy band.
        { freq: 3500, gain: 1.5, q: 0.9 },
      ],
      highShelf: { freq: 10000, gain: 2 },
      compressor: KEYS_COMP,
      reverbSend: 0.24,
      trim: 0.85,
    },
    solo: {
      highPassHz: 120,
      peak: { freq: 3000, gain: 2, q: 1 },
      reverbSend: 0.3,
      trim: 0.9,
    },
  },
}

function derive(
  id: string,
  label: string,
  patch: Partial<StyleEffectPreset>,
): StyleEffectPreset {
  return {
    ...DEFAULT_PRESET,
    id,
    label,
    ...patch,
    reverb: { ...DEFAULT_PRESET.reverb, ...(patch.reverb ?? {}) },
    master: { ...DEFAULT_PRESET.master, ...(patch.master ?? {}) },
    parts: {
      ...DEFAULT_PRESET.parts,
      ...(patch.parts ?? {}),
    },
  }
}

export const STYLE_EFFECT_PRESETS: Record<string, StyleEffectPreset> = {
  funk: derive("funk", "Tight room", {
    reverb: { ir: "room-small.ogg", wet: 0.14, sendHighPassHz: 300 },
    master: { threshold: -14, knee: 4, ratio: 3, attack: 0.004, release: 0.12, gain: 0.9 },
    parts: {
      ...DEFAULT_PRESET.parts,
      drums: {
        ...DEFAULT_PRESET.parts.drums,
        // Funk wants the kit tighter, but still never fast enough to
        // swallow the transient.
        compressor: { ...DRUM_COMP, threshold: -16, ratio: 3, attack: 0.012 },
        reverbSend: 0.06,
        trim: 1.0,
      },
      // Warm funk rhythm: more body, less string air. Quack lives in the
      // low-presence band; everything above ~4 kHz is cut, not boosted.
      guitar: {
        ...DEFAULT_PRESET.parts.guitar,
        reverbSend: 0.1,
        highPassHz: 110,
        peaks: [
          { freq: 280, gain: -2, q: 1.0 },
          { freq: 800, gain: -2, q: 1.1 },
          // Soft quack — definition without the icepick.
          { freq: 1800, gain: 2, q: 1.0 },
          // Pull the cheap DI fizz.
          { freq: 4500, gain: -4, q: 1.0 },
          { freq: 7000, gain: -5, q: 0.8 },
        ],
        highShelf: { freq: 6000, gain: -3 },
        compressor: {
          threshold: -18,
          knee: 6,
          ratio: 3.5,
          attack: 0.012,
          release: 0.12,
        },
        trim: 0.88,
      },
      keys: {
        ...DEFAULT_PRESET.parts.keys,
        compressor: { ...KEYS_COMP, ratio: 2.5, threshold: -18 },
        trim: 0.88,
      },
      // Funk bass wants the fingers audible — more grit, more presence.
      bass: {
        ...DEFAULT_PRESET.parts.bass,
        drive: { ...BASS_AMP, amount: 0.38, mix: 0.45 },
        compressor: { ...BASS_COMP, ratio: 6, threshold: -24 },
        trim: 1.05,
      },
    },
  }),

  ballad: derive("ballad", "Long plate", {
    reverb: { ir: "plate-long.ogg", wet: 0.38, sendHighPassHz: 180 },
    master: { threshold: -10, knee: 8, ratio: 2, attack: 0.01, release: 0.25, gain: 0.9 },
    parts: {
      ...DEFAULT_PRESET.parts,
      // Ballad piano is the lead voice — leave its dynamics almost untouched.
      keys: {
        ...DEFAULT_PRESET.parts.keys,
        reverbSend: 0.42,
        compressor: { ...KEYS_COMP, ratio: 1.6, threshold: -12 },
        highShelf: { freq: 10000, gain: 3 },
        trim: 1.05,
      },
      // Acoustic steel-string (see STYLE_ROLE_INSTRUMENTS): no amp, no cabinet.
      // Body warmth low, string detail high.
      guitar: {
        ...DEFAULT_PRESET.parts.guitar,
        reverbSend: 0.34,
        highPassHz: 80,
        peaks: [
          { freq: 250, gain: -2, q: 1.0 },
          { freq: 3500, gain: 2, q: 0.9 },
        ],
        highShelf: { freq: 9000, gain: 2 },
        trim: 0.8,
      },
      // Softest bass bed under the piano — barely any grit.
      bass: {
        ...DEFAULT_PRESET.parts.bass,
        drive: { ...BASS_AMP, amount: 0.12, mix: 0.18 },
        lowShelf: { freq: 80, gain: 2 },
        peaks: [
          { freq: 250, gain: -2, q: 1.0 },
          { freq: 800, gain: 1, q: 1.0 },
          { freq: 2400, gain: 1, q: 0.9 },
        ],
        compressor: { ...BASS_COMP, ratio: 4, threshold: -20 },
        trim: 0.88,
      },
      drums: { ...DEFAULT_PRESET.parts.drums, reverbSend: 0.16, trim: 0.82 },
    },
  }),

  rock: derive("rock", "Big room", {
    reverb: { ir: "room-large.ogg", wet: 0.26, sendHighPassHz: 250 },
    master: { threshold: -13, knee: 4, ratio: 3.2, attack: 0.005, release: 0.14, gain: 0.88 },
    parts: {
      ...DEFAULT_PRESET.parts,
      drums: {
        ...DEFAULT_PRESET.parts.drums,
        compressor: { ...DRUM_COMP, threshold: -16, ratio: 3.2 },
        peak: { freq: 4000, gain: 3, q: 0.8 },
        reverbSend: 0.18,
        trim: 1.05,
      },
      /**
       * Rock guitar: Soldano high-gain (STYLE_RIGS) + cabinet + dotted-8th
       * delay. SolidGuitar2 is clean DI, so the amp supplies all the gain.
       */
      guitar: {
        ...DEFAULT_PRESET.parts.guitar,
        // Light dotted-8th slap — was muddy at mix 0.18 / feedback 0.28 / send 0.3.
        delay: { beats: 0.75, feedback: 0.14, mix: 0.08, dampHz: 2800 },
        compressor: { threshold: -20, knee: 6, ratio: 4, attack: 0.012, release: 0.16 },
        peaks: [
          { freq: 350, gain: -3, q: 1.0 },
          { freq: 900, gain: 2.5, q: 1.0 },
          { freq: 2600, gain: 2.5, q: 0.9 },
        ],
        reverbSend: 0.12,
        trim: 0.82,
      },
      // Medium grit so the bass growls under Soldano without muddying it.
      bass: {
        ...DEFAULT_PRESET.parts.bass,
        drive: { ...BASS_AMP, amount: 0.32, mix: 0.4 },
        peaks: [
          { freq: 250, gain: -3.5, q: 1.0 },
          { freq: 800, gain: 3, q: 1.1 },
          { freq: 2400, gain: 2, q: 0.9 },
        ],
        trim: 1.0,
      },
      // Grand: firmer, drier, slight presence so it cuts a loud mix.
      keys: {
        ...DEFAULT_PRESET.parts.keys,
        reverbSend: 0.16,
        compressor: { ...KEYS_COMP, ratio: 2.5, threshold: -18 },
        peaks: [
          { freq: 320, gain: -2.5, q: 1.1 },
          { freq: 3500, gain: 2.5, q: 0.9 },
        ],
        trim: 0.7,
      },
    },
  }),

  pop: derive("pop", "Modern room", {
    reverb: { ir: "room-small.ogg", wet: 0.26 },
    master: { threshold: -12, knee: 6, ratio: 3, attack: 0.005, release: 0.16, gain: 0.9 },
    parts: {
      ...DEFAULT_PRESET.parts,
      // Mesa clean (chime) + polished radio EQ — pop was almost defaults only.
      guitar: {
        ...DEFAULT_PRESET.parts.guitar,
        reverbSend: 0.18,
        highPassHz: 120,
        peaks: [
          { freq: 350, gain: -3, q: 1.0 },
          { freq: 1800, gain: 1.5, q: 1.0 },
          { freq: 4500, gain: 2.5, q: 0.9 },
        ],
        highShelf: { freq: 10000, gain: 1.5 },
        trim: 0.85,
      },
      bass: {
        ...DEFAULT_PRESET.parts.bass,
        drive: { ...BASS_AMP, amount: 0.22, mix: 0.28 },
        peaks: [
          { freq: 250, gain: -2.5, q: 1.0 },
          { freq: 900, gain: 2, q: 1.0 },
          { freq: 2800, gain: 2, q: 0.9 },
        ],
        trim: 0.95,
      },
      // Suitcase EP: own polish on top of INSTRUMENT_EFFECTS soft-clip.
      keys: {
        ...DEFAULT_PRESET.parts.keys,
        reverbSend: 0.22,
        highPassHz: 60,
        peaks: [
          { freq: 280, gain: -2, q: 1.0 },
          { freq: 2200, gain: 2.5, q: 0.9 },
        ],
        highShelf: { freq: 11000, gain: 2.5 },
        compressor: { ...KEYS_COMP, ratio: 2.2, threshold: -17 },
        trim: 0.9,
      },
      drums: { ...DEFAULT_PRESET.parts.drums, trim: 0.95 },
    },
  }),

  rnb: derive("rnb", "Warm plate", {
    reverb: { ir: "plate-long.ogg", wet: 0.28, sendHighPassHz: 220 },
    parts: {
      ...DEFAULT_PRESET.parts,
      keys: {
        ...DEFAULT_PRESET.parts.keys,
        reverbSend: 0.3,
        highShelf: { freq: 9000, gain: 2.5 },
        peaks: [
          { freq: 320, gain: -1.5, q: 1.1 },
          { freq: 3000, gain: 2, q: 0.9 },
        ],
        trim: 0.95,
      },
      // Silky Princeton clean: warmer low-mids under the EP.
      guitar: {
        ...DEFAULT_PRESET.parts.guitar,
        reverbSend: 0.22,
        highPassHz: 110,
        peaks: [
          { freq: 280, gain: -1.5, q: 1.0 },
          { freq: 450, gain: 1, q: 1.0 },
          { freq: 2000, gain: 1.5, q: 1.0 },
          { freq: 4000, gain: 1, q: 0.9 },
        ],
        trim: 0.82,
      },
      bass: {
        ...DEFAULT_PRESET.parts.bass,
        lowShelf: { freq: 80, gain: 3.5 },
        drive: { ...BASS_AMP, amount: 0.26, mix: 0.32 },
        peaks: [
          { freq: 250, gain: -2.5, q: 1.0 },
          { freq: 800, gain: 1.5, q: 1.0 },
          { freq: 2200, gain: 1.5, q: 0.9 },
        ],
        trim: 1.02,
      },
      drums: { ...DEFAULT_PRESET.parts.drums, trim: 0.92 },
    },
  }),

  country: derive("country", "Natural room", {
    reverb: { ir: "room-small.ogg", wet: 0.2 },
    parts: {
      ...DEFAULT_PRESET.parts,
      // Acoustic steel-string: brighter top than ballad, no amp.
      guitar: {
        ...DEFAULT_PRESET.parts.guitar,
        highPassHz: 80,
        peaks: [
          { freq: 250, gain: -2, q: 1.0 },
          { freq: 3800, gain: 2.5, q: 0.9 },
        ],
        highShelf: { freq: 9000, gain: 2.5 },
        trim: 0.88,
      },
      bass: {
        ...DEFAULT_PRESET.parts.bass,
        drive: { ...BASS_AMP, amount: 0.18, mix: 0.22 },
        peaks: [
          { freq: 250, gain: -2.5, q: 1.0 },
          { freq: 800, gain: 1.5, q: 1.0 },
          { freq: 2800, gain: 3, q: 0.9 },
        ],
        trim: 0.95,
      },
      keys: {
        ...DEFAULT_PRESET.parts.keys,
        reverbSend: 0.18,
        highShelf: { freq: 10000, gain: 3 },
        peaks: [
          { freq: 320, gain: -2, q: 1.1 },
          { freq: 4000, gain: 2, q: 0.9 },
        ],
        trim: 0.85,
      },
      drums: { ...DEFAULT_PRESET.parts.drums, trim: 0.95 },
    },
  }),

  "swing-jazz": derive("swing-jazz", "Club", {
    reverb: { ir: "room-large.ogg", wet: 0.3, sendHighPassHz: 200 },
    // Jazz wants dynamics left alone; barely any bus compression.
    master: { threshold: -8, knee: 10, ratio: 1.6, attack: 0.015, release: 0.3, gain: 0.92 },
    parts: {
      ...DEFAULT_PRESET.parts,
      drums: {
        ...DEFAULT_PRESET.parts.drums,
        compressor: undefined,
        reverbSend: 0.18,
        trim: 0.88,
      },
      // Archtop DI: warm, rolled off, STYLE_RIGS null — no amp.
      guitar: {
        ...DEFAULT_PRESET.parts.guitar,
        peaks: [
          { freq: 350, gain: -1, q: 1.0 },
          { freq: 1600, gain: 1, q: 1.0 },
        ],
        highShelf: { freq: 6000, gain: -2 },
        compressor: { ...GUITAR_COMP, ratio: 2, threshold: -14 },
        trim: 0.85,
      },
      // Soft upright-ish bed: low grit, softer top.
      bass: {
        ...DEFAULT_PRESET.parts.bass,
        drive: { ...BASS_AMP, amount: 0.15, mix: 0.2 },
        lowShelf: { freq: 70, gain: 2 },
        peaks: [
          { freq: 250, gain: -2, q: 1.0 },
          { freq: 800, gain: 1, q: 1.0 },
          { freq: 2400, gain: -1, q: 0.9 },
        ],
        compressor: { ...BASS_COMP, ratio: 3.5, threshold: -18 },
        trim: 0.92,
      },
      keys: {
        ...DEFAULT_PRESET.parts.keys,
        compressor: { ...KEYS_COMP, ratio: 1.5 },
        trim: 0.92,
      },
    },
  }),

  reggae: derive("reggae", "Dub space", {
    reverb: { ir: "plate-long.ogg", wet: 0.34, sendHighPassHz: 260 },
    parts: {
      ...DEFAULT_PRESET.parts,
      // Skank: thin and bright on purpose, so the chops cut through the space.
      guitar: {
        ...DEFAULT_PRESET.parts.guitar,
        reverbSend: 0.36,
        highPassHz: 200,
        peaks: [
          { freq: 500, gain: -3, q: 1.2 },
          { freq: 2600, gain: 3, q: 1.0 },
        ],
        trim: 0.75,
      },
      // Dub bass is round and clean — pull the drive right back and let the
      // low end dominate.
      bass: {
        ...DEFAULT_PRESET.parts.bass,
        lowShelf: { freq: 70, gain: 4 },
        drive: { ...BASS_AMP, amount: 0.1, mix: 0.15 },
        peaks: [{ freq: 250, gain: -2, q: 1.0 }],
        trim: 1.1,
      },
      // Grand: drier than ballad, clear mid so it sits above the sub.
      keys: {
        ...DEFAULT_PRESET.parts.keys,
        reverbSend: 0.18,
        peaks: [
          { freq: 320, gain: -2.5, q: 1.1 },
          { freq: 2800, gain: 2.5, q: 0.9 },
        ],
        highShelf: { freq: 10000, gain: 1 },
        trim: 0.78,
      },
      drums: { ...DEFAULT_PRESET.parts.drums, trim: 0.9 },
    },
  }),

  blues: derive("blues", "Small hall", {
    reverb: { ir: "room-large.ogg", wet: 0.24 },
    master: { threshold: -10, knee: 8, ratio: 2, attack: 0.008, release: 0.2, gain: 0.9 },
    parts: {
      ...DEFAULT_PRESET.parts,
      // Mid-forward crunch (STYLE_RIGS) — cranked small amp.
      guitar: {
        ...DEFAULT_PRESET.parts.guitar,
        reverbSend: 0.22,
        peaks: [
          { freq: 350, gain: -1.5, q: 1.0 },
          { freq: 900, gain: 2, q: 1.0 },
          { freq: 2600, gain: 2, q: 0.9 },
        ],
        trim: 0.88,
      },
      bass: {
        ...DEFAULT_PRESET.parts.bass,
        drive: { ...BASS_AMP, amount: 0.36, mix: 0.42 },
        peaks: [
          { freq: 250, gain: -3, q: 1.0 },
          { freq: 700, gain: 2.5, q: 1.1 },
          { freq: 2200, gain: 2, q: 0.9 },
        ],
        trim: 1.0,
      },
      keys: {
        ...DEFAULT_PRESET.parts.keys,
        reverbSend: 0.22,
        peaks: [
          { freq: 280, gain: -1, q: 1.0 },
          { freq: 900, gain: 1.5, q: 1.0 },
          { freq: 3200, gain: 1.5, q: 0.9 },
        ],
        highShelf: { freq: 9000, gain: 1 },
        trim: 0.8,
      },
      drums: { ...DEFAULT_PRESET.parts.drums, trim: 0.95 },
    },
  }),
}

export function presetForStyle(styleId: string): StyleEffectPreset {
  const base = STYLE_EFFECT_PRESETS[styleId] ?? DEFAULT_PRESET
  const trims = STYLE_PART_TRIMS[styleId]
  if (!trims) return base
  const parts = { ...base.parts }
  for (const [part, trim] of Object.entries(trims) as [BandPart, number][]) {
    const cur = parts[part]
    if (!cur || trim == null) continue
    parts[part] = { ...cur, trim }
  }
  return { ...base, parts }
}

/**
 * Genos-inspired part levels for the jam mix.
 *
 * Source: SInt-block MIDI CC7 on Rhythm1/2, Bass, Chord1, Chord2 from the
 * Genos 2 style files under Desktop/2 Genos 2 (Rock-51, Pop-78, R&B-60,
 * Jazz-46, EasyListening ballads, Country-51, reggae-named World/Latin,
 * curated FunkPopRock + Smokin'Soul for funk). Absolute CC7 values are low
 * (~30–70) for keyboard headroom; we use RELATIVE balance within each style,
 * scaled so the band centres near 1.0, then nudged for jam roles (ballad
 * keys lead, reggae bass leads, rock keys tucked, funk CHD1 tucked).
 *
 * `presetForStyle` overlays these onto each style's part settings so the
 * matrix stays the single place to edit mix balance.
 */
export const STYLE_PART_TRIMS: Record<
  string,
  Partial<Record<BandPart, number>>
> = {
  // Rock: drums forward, keys under the guitars (PowerRock / HardRock ratios).
  rock: { drums: 1.1, bass: 1.02, guitar: 0.72, keys: 0.72 },
  // Funk: bass up; Chord1 CHD guitar deliberately quiet in Genos (~36 vs ~50).
  funk: { drums: 1.05, bass: 1.1, guitar: 0.68, keys: 0.9 },
  // Pop: even radio balance, slight keys presence; guitar a step under the kit.
  pop: { drums: 1.0, bass: 1.02, guitar: 0.72, keys: 0.96 },
  // Ballad: piano is the lead voice in the jam arrangement.
  ballad: { drums: 0.85, bass: 0.9, guitar: 0.68, keys: 1.08 },
  // R&B: EP/keys sit with the groove; guitar a step under.
  rnb: { drums: 0.98, bass: 1.04, guitar: 0.7, keys: 1.0 },
  blues: { drums: 1.0, bass: 1.04, guitar: 0.74, keys: 0.9 },
  country: { drums: 1.02, bass: 1.0, guitar: 0.72, keys: 0.86 },
  // Jazz-46: keys/pad loud with the kit; brush kit wants drums a touch softer.
  "swing-jazz": { drums: 0.92, bass: 0.94, guitar: 0.7, keys: 1.02 },
  // Reggae: dub bass dominant, skank guitar thin.
  reggae: { drums: 0.98, bass: 1.12, guitar: 0.62, keys: 0.8 },
}

// ---------------------------------------------------------------------------
// Layer 1: instrument voicing, and the resolver that ties the layers together
// ---------------------------------------------------------------------------

type InstrumentVoice = Partial<PartEffectSettings> & {
  /**
   * Default rig for this instrument. `null` means NEVER amplified — no style
   * can switch one on. That is the property that makes it structurally
   * impossible to put an acoustic guitar through a 4x12 by accident.
   */
  rig?: string | null
}

/**
 * What a given SOUND SOURCE needs, independent of style.
 *
 * The part slot is not enough to decide this: `guitar` is a solid-body electric
 * in rock and a steel-string acoustic in country, and `keys` is a Rhodes in funk
 * and a grand in ballad. Treating them identically because they occupy the same
 * slot is what produced an amp on everything.
 *
 * Anything absent falls through to the part defaults in DEFAULT_PRESET.
 */
export const INSTRUMENT_EFFECTS: Record<string, InstrumentVoice> = {
  "guitar-steel": {
    // Acoustic. An amp is wrong here in EVERY style, so it is refused outright
    // rather than left to each style to remember.
    rig: null,
    highPassHz: 80,
    peaks: [
      { freq: 250, gain: -2, q: 1.0 },
      { freq: 3800, gain: 2.5, q: 0.9 },
    ],
    highShelf: { freq: 9000, gain: 2.5 },
  },
  "guitar-solid2": {
    // Clean DI sample set — it has no character of its own, so the rig supplies
    // all of it. Styles choose which.
    rig: "clean",
  },
  "guitar-emily": {
    // Karoryfer Emilyguitar: real DI flatwound. Same role as SolidGuitar2 —
    // amp/cabinet from the style rig, not baked into the samples.
    // Space (light slap + a touch of reverb) and two −25% trim cuts are
    // applied in resolveChannelEffects so style blocks cannot wipe them.
    rig: "clean",
    highPassHz: 70,
    peaks: [
      { freq: 220, gain: -1.5, q: 0.9 },
      { freq: 2800, gain: 1.5, q: 0.8 },
    ],
    highShelf: { freq: 7000, gain: 1.0 },
  },
  "guitar-solid1": { rig: "clean" },
  "guitar-distortion": {
    // Already-clipped samples. Stacking a high-gain amp on top turns it to
    // mush, so it gets the mildest rig regardless of style.
    rig: "crunch",
  },
  "keys-suitcase-ep": {
    // A Rhodes is an electric instrument and wants a little grit, unlike a
    // grand. Not a guitar rig — just the fallback soft-clip, gently.
    highPassHz: 60,
    drive: { amount: 0.18, driveHighPassHz: 300, mix: 0.25 },
    peaks: [
      { freq: 280, gain: -1.5, q: 1.0 },
      { freq: 2400, gain: 2, q: 0.9 },
    ],
    highShelf: { freq: 11000, gain: 2 },
  },
  "piano-grand": {
    highPassHz: 45,
  },
}

/**
 * Which rig each style puts its guitar through.
 *
 * Three states, deliberately distinct:
 *   - a rig id  -> use it
 *   - `null`    -> this style uses NO amp, overriding the instrument's default
 *   - absent    -> fall through to the instrument's own default rig
 *
 * An instrument with `rig: null` refuses an amp regardless of this table.
 *
 * Matrix (approved style amp pass):
 *   funk            -> funk (Mesa clean pushed, rock cab)
 *   rnb/reggae      -> clean (Princeton)
 *   pop             -> chime (Mesa clean)
 *   blues           -> crunch
 *   rock            -> high-gain
 *   swing-jazz      -> null (archtop DI)
 *   ballad/country  -> absent; guitar-steel refuses amp
 */
export const STYLE_RIGS: Record<
  string,
  Partial<Record<BandPart, string | null>>
> = {
  rock: { guitar: "high-gain" },
  blues: { guitar: "crunch" },
  funk: { guitar: "funk" },
  pop: { guitar: "chime" },
  rnb: { guitar: "clean" },
  reggae: { guitar: "clean" },
  // An archtop into a 4x12 is as wrong as an acoustic into one. Jazz comping
  // is a warm, rolled-off, entirely un-amped tone here.
  "swing-jazz": { guitar: null },
  // ballad and country play guitar-steel, which refuses a rig outright.
}

function mergeVoice(
  base: PartEffectSettings,
  voice: InstrumentVoice | undefined,
): PartEffectSettings {
  if (!voice) return base
  const { rig: _rig, ...rest } = voice
  // Field-level merge, so an instrument can restate one band without having to
  // repeat the whole part block.
  return { ...base, ...rest }
}

/**
 * Resolve the effects for one channel from all three layers.
 *
 * Order is instrument -> style -> rig:
 *  - the instrument says what the sound source needs and whether it may be
 *    amplified at all,
 *  - the style applies its deltas,
 *  - the rig is attached last, and only if something explicitly named one.
 */
export function resolveChannelEffects(
  part: BandPart,
  instrumentId: string | undefined,
  styleId: string,
): PartEffectSettings {
  const preset = presetForStyle(styleId)
  const voice = instrumentId ? INSTRUMENT_EFFECTS[instrumentId] : undefined

  // Style block wins over instrument voicing for shared fields; the instrument
  // sits between the part defaults and the style.
  const base = mergeVoice(DEFAULT_PRESET.parts[part] ?? {}, voice)
  const resolved: PartEffectSettings = { ...base, ...(preset.parts[part] ?? {}) }

  // `drive` is decided by the rig layer alone for guitar, so drop whatever the
  // merge carried in before reattaching.
  if (part === "guitar") {
    delete resolved.drive
    if (voice?.rig !== null) {
      const styleRig = STYLE_RIGS[styleId]?.[part]
      // `null` from the style means "no amp here", which must beat the
      // instrument default; `undefined` means "not specified, inherit".
      const rigId = styleRig === undefined ? voice?.rig : styleRig
      const rig = rigId ? AMP_RIGS[rigId] : undefined
      if (rigId && !rig) {
        console.warn(`[effects] unknown rig "${rigId}" for ${styleId}/${part}`)
      }
      if (rig) resolved.drive = rig
    }
  }

  // Emilyguitar: thick DI wants a little air, and sits hot next to the kit.
  // Applied after the style merge so every electric style gets it — style
  // guitar blocks would otherwise overwrite instrument-level send/trim and
  // leave most styles with no delay at all.
  if (instrumentId === "guitar-emily" && (part === "guitar" || part === "solo")) {
    if (!resolved.delay) {
      // Very light slap — just enough air, not a audible echo trail.
      resolved.delay = { beats: 0.25, feedback: 0.1, mix: 0.045, dampHz: 2800 }
    }
    resolved.reverbSend = Math.min(0.42, (resolved.reverbSend ?? 0.18) + 0.1)
    // Two −25% cuts from the style trim (Emily reads hot against the kit).
    resolved.trim = (resolved.trim ?? 0.9) * 0.75 * 0.75
  }

  return resolved
}
