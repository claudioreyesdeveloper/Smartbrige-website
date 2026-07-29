# Jam Player — Voice Engine Design (MIDI + MegaVoice)

**Status:** design, agreed direction
**Date:** 2026-07-27
**Companion to:** `jam-player-product-plan.md` §8 ("What has to be true technically")

Resolves the open engine question: how to keep Yamaha MegaVoice articulation while driving
everything from MIDI rather than pre-rendered audio.

---

## 1. Why MegaVoice fits a MIDI engine

Yamaha designed MegaVoice for **sequenced data, not live performance**. A MegaVoice packs multiple
articulations of one instrument into a single program, selected by velocity band and by key range:

- **Playable range (≤ 83):** velocity bands select *articulations* — sustained, muted, dead note,
  hammer-on, slide.
- **Above 83:** not pitches at all. Fret noise, string slaps, pick scrapes, body hits.

Yamaha states MegaVoices are unsuitable for playing by hand, precisely because velocity means
articulation rather than dynamics. This is why they belong in a MIDI-driven arrangement engine —
we are using the technology as intended, not working around it.

The pilot already encodes the essential rule as `MEGAVOICE_PITCH_MAX = 83` in
`scripts/band_jam_pilot/render_stems.py`. The pre-render architecture then discards that
intelligence by freezing it into WAVs. The fix is to keep the MIDI.

---

## 2. Architecture: one event stream, two sinks

```
  midi_clips  +  roman_progression_patterns
                      │
                      ▼
            arrangement engine  (TypeScript)
        tile_events · adapt_harmonic · fold_to_register
                      │
                      ▼
              MIDI event stream
                (note, vel, t, dur)
                      │
        ┌─────────────┴──────────────┐
        ▼                            ▼
  Browser sampler              Web MIDI out
  (AudioWorklet + SFZ)         (real PSR / Tyros / Genos)
  — every user                 — Yamaha owners
```

Both sinks consume **identical events**. This is what makes "MIDI with MegaVoice" one engine
rather than two products, and it is why Web MIDI (plan §7, v1.1) is cheap once Path A exists.

---

## 3. Path A — browser sampler

### 3.1 The complete opcode surface

Inventoried across all converted SFZs (`prototype/converted/`). This is **everything** the engine
must implement — 13 opcodes:

| Opcode | Uses | Role |
|---|---|---|
| `sample` | 177 | Which file |
| `offset`, `end` | 177 each | Slice bounds within the file — **mandatory, see 3.3** |
| `loop_mode` | 177 | 388 `no_loop`, 5 `loop_continuous` |
| `lokey`, `hikey`, `key` | 116 / 116 / 61 | Key-range match |
| `pitch_keycenter` | 116 | Pitch-shift reference |
| `lovel`, `hivel` | 97 each | Velocity-band match — **articulation selection** |
| `volume` | 118 | Region gain (dB) |
| `amp_veltrack` | 177 | Velocity→gain depth |
| `ampeg_release`, `ampeg_sustain` | 24 / 3 | Amp envelope |
| `transpose` | 1 | Fixed offset |

No filters, no LFOs, no crossfades, no round-robin, no keyswitches. A region lookup table,
`playbackRate` pitch shifting, and a release envelope.

**Estimate: a few hundred lines in an AudioWorklet.** This is not a sfizz-to-WASM port, and
choosing a general-purpose SFZ player would mean inheriting a large engine to use 13 opcodes —
and then fighting it over the MegaVoice rules in 3.3.

### 3.2 Region map shape

`077_SolidGuitar1 MegaVoice.sfz` — 112 regions as 11 key zones × 8 velocity layers:

```
KEY ZONE   VEL LAYERS   ROLE
  0-  0        1        (catch-all)
 10- 36        8        pitched
 37- 42        8        pitched
 43- 48        8        pitched
 49- 54        8        pitched
 55- 60        8        pitched
 61- 66        8        pitched
 67- 72        8        pitched
 73- 77        8        pitched
 78- 85        8        FX / articulation
 86- 95        8        FX / articulation
```

The conversion captured MegaVoice's *behaviour* rather than its logic: each (key zone, velocity
layer) cell is a real recording of what the MegaVoice actually produces there. **The engine does
not model MegaVoice — it plays the right cell.** Lookup is a 2D range match on (note, velocity).

### 3.3 Three rules the engine must not break

**1. Velocity selects articulation, not loudness.**

Measured on SolidGuitar1 at key 60:

| Velocity | Sample length | What it is |
|---|---|---|
| 20 | 11.51 s | sustained |
| 40 | 12.96 s | sustained |
| 75 | 0.61 s | muted / dead note |
| 90 | 1.76 s | short articulation |

Consequences:

- **The band-intensity control (plan §7, v1.1) must never scale MIDI velocity.** Turning the band
  "down" would silently convert sustained notes into dead notes. Intensity comes from **clip
  substitution** (the 4,684 `alt_main` clips) and **audio-level gain** — never from velocity.
- Any future humanisation or dynamics feature has the same constraint.
- Velocity-layer count must not be reduced to save download size (see 3.4).

**2. Notes above 83 are inviolate.** No transposition, no register folding, no velocity remap, and
they must survive key changes untouched. `adapt_harmonic` already honours this; the browser engine
must too. Getting this wrong turns fret noise into pitched garbage on every transpose.

**3. `offset` is mandatory.** All 177 regions specify it — the auto-sampled WAVs carry pre-roll
silence. Ignoring `offset` makes every note late. This alone disqualifies naive
`AudioBufferSourceNode.start()` usage without slice bounds.

Minor: the 5 `loop_continuous` regions carry no `loop_start` / `loop_end`, so loop the
`offset..end` span.

### 3.4 Download budget

Current raw footprint:

| Instrument | Size | Files |
|---|---|---|
| SolidGuitar1 MegaVoice | 209 MB | 112 |
| ElectricBass MegaVoice | 118 MB | 44 |
| StandardKit1 | 33 MB | 101 |

Samples are 9–13 s **true stereo** (verified, not dual-mono) 48 kHz WAV — of which a groove uses
roughly 2–3 s. The waste is duration, not layer count.

**Reduction strategy, in order:**

1. **Trim to real decay + release tail.** ~4× saving. The largest win by far.
2. **Opus encode** (~96–128 kbps stereo). ~8× on top.
3. **Do not drop velocity layers.** They are the articulations (rule 1). This is the tempting
   optimisation and it is the wrong one.

Estimated result: **~12–18 MB for the full band**, fetched once and cached. Load progressively —
bass and drums first so playback can start before guitar finishes.

*These are estimates from sample duration and channel analysis; the spike (§5) confirms them.*

---

## 4. Path B — Web MIDI to real hardware

Nearly free once the event stream exists, and the addressing is **already in `smartbridge.db`**.
`keyboard_voices` carries the real MegaVoice bank map:

| Voice | MSB | LSB | PRG |
|---|---|---|---|
| MegaNylonGuitar | 8 | 0 | 1 |
| MegaSteelGuitar | 8 | 0 | 2 |
| MegaCleanGuitar | 8 | 0 | 4 |
| **MegaSolidGuitar1** | **8** | **1** | **4** |
| MegaSolidGuitar2 | 8 | 2 | 4 |
| MegaOverdriveGtr | 8 | 0 | 5 |
| MegaAcousticBass | 8 | 0 | 17 |

Coverage: 14 MegaVoices for `psr_s900`, 18 for `tyros2`, plus `genos1` / `genos2` entries, with a
proper `MegaVoice` category and `A.Guitar` / `E.Guitar` / `Bass` sub-categories. Note that
`MegaSolidGuitar1` is exactly the voice the pilot converted as `077_SolidGuitar1 MegaVoice`.

Per part: send Bank Select MSB → Bank Select LSB → Program Change, then the note stream. FX notes
above 83 reach the keyboard's genuine ROM articulations.

Strategic value beyond the feature: this is the Style Maker on-ramp in plan §4. A Jam Player
subscriber discovers their keyboard can play the arrangement, which is the natural path to
All Access.

---

## 5. Build order

1. **Spike — one instrument, end to end.** Bass (44 regions, smallest) → region parser →
   AudioWorklet → arbitrary key and tempo. Verify on desktop **and real iOS**. Confirms both the
   engine estimate and the §3.4 payload numbers.
2. **Sample pipeline.** Trim + Opus + manifest generation, as an offline script beside
   `build_gm_drum_sfz.py`.
3. **Port the arrangement engine.** `tile_events`, `adapt_harmonic`, `fold_to_register` and the
   >83 rule from `render_stems.py` to TypeScript, emitting the event stream of §2.
4. **Guitar and drums**, including the GM drum remap already solved in `build_gm_drum_sfz.py`.
5. **Convert the remaining MegaVoices** (§6.1) — 8–10 more NKIs through the existing
   ConvertWithMoss path. Unlocks the plan's v1 style breadth; no engine changes required.
6. **Web MIDI sink** (Path B) — small, once §2 is in place.

Steps 1 and 2 are where the risk is. Everything after is mechanical.

---

## 6. Sound sources

### 6.1 The source library is larger than the pilot suggests

`/Volumes/Second/KontaktLib/Yamaha PSR S900` — 9.2 GB, 415 NKIs, 9,625 NCW samples. The pilot
converted **2 MegaVoices**. There are **15**:

| Family | MegaVoices available |
|---|---|
| Bass | Acoustic, Electric\*, Pick, Fretless |
| Guitar | Nylon, Steel, 12-String, HiStrings, SolidGuitar1\*, SolidGuitar2, Clean, Overdrive, Distortion |
| Horns | TenorSax, Trumpet |

<sub>\* converted in the pilot</sub>

This largely answers the plan's v1 style-breadth item (§7, target 10–12 styles): nylon/steel for
Ballad and Acoustic, clean for Pop and R&B, overdrive/distortion for Rock and Metal,
acoustic/fretless bass for Jazz and Ballad. **All share one articulation convention**, so they
drop into the engine with no new logic — converting 8–10 more NKIs is the whole task.

### 6.2 Conversion tooling

| Tool | Role |
|---|---|
| [ConvertWithMoss](https://www.mossgrabers.de/Software/ConvertWithMoss/ConvertWithMoss.html) | Already proven here. Free, active (v19), reads NKI + NCW, writes SFZ / DecentSampler / SF2 / MPC / Bitwig / EXS. Batch-capable — **scale up the existing path, don't replace it** |
| [monomadic/ncw](https://github.com/monomadic/ncw) | Zero-dependency Rust NCW decoder + `ncw-decode` CLI (part of `ni-file`). Fallback for NKIs ConvertWithMoss rejects; basis for a scripted pipeline |
| nkitool (LinuxSampler) | Older NKI→SFZ path. Likely redundant |

**Stay on SFZ as the target.** DecentSampler is a capable engine but a desktop plugin with no
browser story. SFZ is text, diffable, and is what the §3 engine reads.

### 6.3 Existing browser SFZ engines (evaluated, not chosen)

| Option | Assessment |
|---|---|
| [sfizz-webaudio](https://github.com/sfztools/sfizz-webaudio) | Official sfizz via emscripten/WASM. Real, but a side branch rather than a mainline release target, and the demo is Chromium-only. Deployment risk for a paid product |
| [sfz-web-player](https://github.com/sfzlab/sfz-web-player) | Pure Web Audio, TypeScript, CC0. ~23 stars, minimal activity. Not production-grade |
| **Custom AudioWorklet** | **Chosen.** 13 opcodes (§3.1); both alternatives bring a full SFZ engine that would then need bending around the MegaVoice rules in §3.3 |

### 6.4 Alternative libraries, and why they are not drop-in

[sfzinstruments.github.io](https://sfzinstruments.github.io/guitars/) indexes SFZ instruments with
licences stated:

| Library | Author | Licence |
|---|---|---|
| Shinyguitar, Emilyguitar, Black_And_Green_Guitars | Karoryfer | **CC0** |
| big-little-bass, black-and-blue-basses, Pastabass, Swagbass | Karoryfer | **CC0** |
| Standard Guitar, Metal GTX, The Slapper | Unreal Instruments | "Custom" — terms need reading |
| Glockenskull, Secret Agent, Snowkiss, Surfkiss | Karoryfer | Commercial |

**Karoryfer is the standout on licence shape.** [Pastabass](https://github.com/sfzinstruments/karoryfer.pastabass)
is royalty-free for commercial use *including conversion into other sampler formats and
redistribution as part of larger sample libraries* — exactly what a product needs, and rare.
Attribution is requested only when redistributing as samples.
[Standard Guitar](https://sfzinstruments.github.io/guitars/standard_guitar/) has real articulation
depth (sustains, palm mutes, harmonics, hammer-on, pull-off; 716 MB FLAC) but its licence is listed
only as "Custom" and must be read before commercial reliance. Per-library articulation contents
are **not** documented in the index — each needs individual verification.

### 6.5 The coupling problem — the important part

**The MIDI data and the sound source are coupled through the articulation convention.**

`midi_clips` are Yamaha style data. They encode articulation the MegaVoice way: velocity band
selects articulation, notes above 83 are FX. Modern SFZ libraries use **keyswitches and separate
articulation groups** — a cleaner model, but a *different* one. A naive swap would send >83
fret-noise notes into whatever the replacement library maps up there.

So alternatives are not sample swaps; they are articulation remaps. To make them genuinely
pluggable rather than theoretically pluggable, the engine needs an **articulation abstraction**:

```
part requests:   "sustain" | "dead" | "mute" | "slide" | "fx:fret_noise"
                          │
                  per-library adapter
                          │
   MegaVoice: velocity band + >83 note
   Karoryfer: keyswitch / separate region group
   Unreal:    keyswitch
```

This is the honest form of the "swappable instrument layer" in plan §8. MegaVoice stays primary —
the rights are settled, the data matches, and 15 voices is real breadth. The abstraction exists so
that a future source change is an adapter, not a rewrite.

---

## 7. What this retires

- The pre-render pipeline (`render_stems.py` → WAV packs) becomes a **reference implementation
  and A/B oracle**, not a shipping path. Keep it — rendering the same arrangement both ways is the
  fastest way to validate the browser engine's musical output.
- `RENDERED_PACKS` / `packs.generated.json` / the `packId` scheme go away entirely.
- `"Not rendered yet"` ceases to exist as a product state.
