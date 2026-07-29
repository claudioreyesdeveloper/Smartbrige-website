# Jam Player — handoff

Written for whoever picks this up next. It covers what exists, what is broken,
and — at least as importantly — **the mistakes made getting here**, because
several of them were made more than once and the pattern matters more than any
individual fix.

Nothing in this work has been committed. `git status` shows the Jam Player as
untracked (`lib/band-jam/`, `components/band-jam/`, `public/jam-player/`,
`app/jam-player/`). Two repos are involved:

| repo | holds |
|---|---|
| `Smartbridge-website` | the Next.js app, the audio engine, the generated catalogue |
| `Smartbridge` | `scripts/band_jam_pilot/*` (the content pipeline) and `smartbridge.db` |

---

## 1. State right now

Green as of this handoff: `npx tsc --noEmit` clean, `npx vitest run` = 304
passing. Two failures in the full suite (`tests/unit/style-maker-audition.test.ts`,
`tests/unit/library-panel.test.ts`) are **pre-existing and unrelated** — one wants
a `/tmp/sb-clip.mid` fixture that does not exist, the other queries local DB
state. Neither file was touched.

Guitar register per style, measured after the last export:

| style | octave shift | source median → arranged | min note |
|---|---|---|---|
| rock | 12 | 65 → 52 | 45 |
| funk | 0 | 69 → 67 | 54 |
| pop | 0 | 60 → 59 | 40 |
| ballad | 0 | 67 → 64 | 45 |
| rnb | 0 | 69 → 66 | 54 |
| country | 0 | 67 → 64 | 45 |
| swing-jazz | 0 | 67 → 62 | 40 |
| reggae | 0 | 67 → 68 | 56 |
| blues | 0 | 69 → 69 | 59 |

---

## 2. What was built

### Audio engine (`lib/band-jam/engine/`)

- **`arrange.ts`** — turns a style + progression into note events. Chord
  adaptation, key-aware enharmonic spelling, per-role variation selection.
- **`effects.ts`** — the mix bus. Per-part EQ / compression / drive / delay,
  one shared reverb convolver, master compressor + limiter.
- **`effects-presets.ts`** — a **three-layer** effect model (see §4.2):
  `INSTRUMENT_EFFECTS` (what a sound source needs) → `STYLE_EFFECT_PRESETS`
  (the room) → `AMP_RIGS` (whether it is amplified at all), resolved by
  `resolveChannelEffects(part, instrumentId, styleId)`.
- **`amp/`** + **`public/jam-player/amp/lstm-amp.worklet.js`** — a real neural
  amp. GuitarML NeuralPi LSTM captures (1 layer, hidden 20) running in an
  AudioWorklet, implemented directly in JS — no WASM, no build step, no
  third-party runtime. Four models shipped: Princeton clean, Mesa clean, Mesa
  crunch, Soldano high-gain.
- **`guitar-voicing.ts`** — 1:1 port of the desktop `GuitarVoicingTransform`,
  53 tests.

### UI (`components/band-jam/`)

`mixer-panel.tsx` + `band-figures.tsx` + `channel-fader.tsx` — the mixer
redesign: original SVG musician figures (one per part, `currentColor` so state
is pure CSS), custom vertical faders with the full slider ARIA contract.
**This is unfinished** — see §5.

### Content pipeline (`Smartbridge/scripts/band_jam_pilot/`)

`export_catalog.py` (the big one) → `catalog.generated.json`, then
`export_clips.py` → `clips.generated.json`. `style_overrides.json` holds
hand-curated per-style picks that beat the automatic selection.

**To rebuild after any content change, both must run, in order:**

```bash
python3 scripts/band_jam_pilot/export_catalog.py && python3 scripts/band_jam_pilot/export_clips.py
```

Forgetting the second one leaves the catalogue referencing clip ids that are not
in the clip file — the app then silently drops those parts.

---

## 3. Licensing — must be resolved before launch

The amp models come from **GuitarML/ToneLibrary, which is GPL-3.0**. They cannot
ship in a commercial product as-is. The runtime code is ours and unaffected;
only the weight files need replacing. Options: capture models with GuitarML's
own trainer, or use CC-BY captures from TONE3000. The loader format is identical
either way.

---

## 4. Mistakes

### 4.1 The recurring one: per-style decisions written as global defaults

This happened **four times**, and every instance was found by the user, not by a
test:

1. **Keys disabled everywhere.** Asked to remove keys *in rock*; wrote a global
   `DISABLED_PARTS = new Set(["keys"])`. Silenced the Rhodes and the grand in all
   eight other styles.
2. **Keys came back in rock.** After scoping the above per style, keys still
   played in rock *if you arrived from another style* — the filter was applied to
   instrument loading and the UI but **not to the arrangement**, and the player
   keeps its `sources`/`partGains` maps across a style change. Fixed by
   filtering in the arrangement itself (the one thing every consumer reads) and
   by dropping stale parts in `BandPlayer.setArrangement`.
3. **Distortion on every guitar.** `drive` lived on `DEFAULT_PRESET.parts.guitar`
   and `derive()` merged per part, so every style inherited an amp unless it
   explicitly wrote `drive: undefined`. Distortion was opt-**out**.
4. **The guitar octave shift.** Asked for it *on rock*; wrote a bare
   `GUITAR_OCTAVE_SHIFT = 12` applied to `partName === "guitar"` with no style
   check, dropping all eight other styles an octave.

The fix in every case is the same shape and is now the convention: **an explicit
per-style table with a default of "nothing"**, never a rule that applies unless
something opts out. See `GUITAR_OCTAVE_SHIFT_BY_STYLE`, `GUITAR_VOICING_BY_STYLE`,
`AMP_RIGS`/`STYLE_RIGS`, `DISABLED_PARTS_BY_STYLE`.

There is a fifth instance of the same *class* still latent: state that outlives a
style change. Three were found (`sources`, `partGains`, the effect chains). If a
fourth appears, the right move is to tear the player down entirely on style
change rather than keep patching individual maps.

### 4.2 The drive knob did nothing for two months of tuning

`makeSoftClipCurve` was `tanh(k·x) / tanh(k)` with `k = 1 + amount·24` —
**peak-normalised**. Once `k > 3` (i.e. `amount > 0.09`), `tanh(k) ≈ 1` and the
curve stopped changing shape:

| amount | saturation at half-scale |
|---|---|
| 0.12 ("clean") | +5.67 dB |
| 0.22 (default) | +5.99 dB |
| 0.72 (rock) | +6.02 dB |

Every style got an identical hard clip and rock could not be made dirtier than
the ballad. Hours were spent reshaping that curve *by ear* — adding
pre-emphasis, cascaded stages, asymmetry — when a five-line numerical check
would have shown the parameter was inert. **Measure the thing before tuning it.**

### 4.3 Verifying on the path that cannot fail

Claimed the keys fix was verified because rock showed no keys — but rock had been
loaded on a *fresh page*, where no keys voice had ever been registered. The bug
only appears when you arrive at rock *from another style*. The test confirmed the
case that could not fail. The regression test now arranges rock after funk
specifically.

### 4.4 Sloppy edits

Patched `effects.ts` with a blind Python string replace, one of two
substitutions silently did not match, and the result was handed over without
running `tsc`. It did not compile. Every edit since is followed by a typecheck.

### 4.5 Chasing metrics instead of checking the data

When the user reported rock's variations sounding identical, the response was
pages of similarity percentages and distinctness ratios. The user's correction
was right: *"all you have to do is make sure that you actually copied the midi
from the style files that I gave you"*. Tracing the clip ids back to their
`source_file` — three lines of SQL — was the check that mattered, and it is now
the standard one (§6).

### 4.6 Running a destructive script without checking it first

`extract_genos_megavoice.py` was run twice for new categories. Both runs
reported `style_guitar_clips now holds 2547 rows` — inserting 1289 new rows and
then 1295 more cannot leave the total unchanged, which should have stopped
everything immediately. It did not, and a second run went ahead.

It turned out to be non-destructive (the script rebuilds the whole table, and
row **ids are reassigned**), and rock's curated files survived. But the id
reassignment invalidated every clip id in the already-generated catalogue.
`style_overrides.json` selects by **source file name, not id**, which is the only
reason this was recoverable by re-running the export.

Note also that an earlier agent in this project destroyed 2,052 rows by running
`git checkout` on `smartbridge.db`. **See the safety rules in §7.**

### 4.7 A "proof" that proved nothing

Tried to establish the LSTM gate order empirically by scoring all 24
permutations. It cannot work — a stable LSTM driven by a periodic input settles
into a periodic output for *every* permutation, so all 24 score identically. The
order comes from RTNeural's `lstm.tpp` (i/f/c/o at offsets 0, h, 2h, 3h), which
is what GuitarML's own plugins use to load these files. The dead end is recorded
in the reference script so nobody repeats it.

---

## 5. Open problems

### 5.1 FunkPopRock.T547 channel 12 is unusable — needs a decision

The user asked for funk Variation A guitar from
`Pop-78/FunkPopRock.T547.prs` channel 12. **That channel has zero pitched notes
in Main A–D** — all 49/158/112/202 notes per section are above `FX_PITCH_MIN`
(89–109), i.e. MegaVoice articulation keys only. Its pitched guitar lives in
Intro B/C and Ending B/C, which the extractor deliberately skips (they carry
composed progressions rather than single-chord vamps).

Using it produced a **completely silent** funk guitar. It has been dropped from
`style_overrides.json` and a guard added (`fetch_curated_clips` now rejects any
curated clip with `note_lo > 83`).

**Needs from the user:** a different channel in that file, or a different file.
Channels in `FunkPopRock.T547` with pitched Main-section content are worth
checking — `ch14` (1-based 15, PHR1) has 380 pitched notes.

`R&B-60/Smokin'Soul.T552` is fine and is in use: guitar on channel 12
(42/64/88/116 pitched per Main section) and keys on channel 13
(84/120/108/108).

### 5.2 The mixer UI is half-built

`MixerPanel` is wired in and works, but:
- The **figures need art direction.** The first attempt used rotated `<rect>`s
  with guessed rotation origins and the guitar and bass came out as
  indistinguishable blobs. They are now built from a computed `bar()` helper
  (two endpoints + thickness), which is correct but has not been reviewed by
  the user.
- The **Chart ⇄ Mixer view toggle was never built.** The mockup's `‹ Chord`
  button implies two views; today the mixer is still stacked below the chart.
- The Yamaha reference's left sidebar (Synchro Start, master Volume, Part
  filter) is not built.
- Not checked at tablet breakpoint or with keyboard-only fader operation.

### 5.3 Rock bass variations B and D are the same clip

The automatic picker chose clip `233642` for variation B, and the user's curated
override names the same clip for variation D. This is a **content** collision,
not a bug — it is now logged loudly during export rather than hidden behind
duplicate padding. Variation D needs a different clip chosen by ear.

### 5.4 Smaller items

- Latin style still cannot build — all 1,385 Latin drum clips are flagged
  `usable_as_main=0`.
- Free-tier content limiting: `hasFullAccess` reaches `PracticeScreen` and is
  unused.
- Billing migration `drizzle/0001_add_subscriptions_plan.sql` is generated but
  **not applied**.
- `rnb` guitar has only 7 clips, so it yields 2 distinct variations out of 4;
  `blues` yields 3. Not a bug — there is simply less material.

---

## 6. How to verify content changes

The check that actually matters — do the clips come from the files that were
asked for:

```python
import json, sqlite3
cat = json.load(open("lib/band-jam/catalog.generated.json"))
con = sqlite3.connect("file:/Users/claudio/Developer/Smartbridge/SmartBridge/Resources/smartbridge.db?mode=ro", uri=True)
KEYS_OFF, GUITAR_OFF = 10_000_000, 20_000_000   # must match export_catalog.py
```

Look up `id - GUITAR_OFF` in `style_guitar_clips`, `id - KEYS_OFF` in
`keyboard_clips`, anything else is a `midi_clips` library id. Current result:

```
rock guitar   A: Rock-51/70sHardRock.T548      C: Rock-51/PowerRock.T548
              B: Rock-51/80sPowerRock.T548     D: Rock-51/70sStraightRock.T548
funk guitar   A-D: R&B-60/Smokin'Soul.T552
funk keys     A: automatic (library)           B: R&B-60/Smokin'Soul.T552
```

Also assert **pitched** note counts, not just note counts — §5.1 is exactly the
failure that slips through otherwise.

---

## 7. Safety rules — carry these forward

- **`smartbridge.db`**: open read-only, `sqlite3.connect("file:...?mode=ro", uri=True)`.
  Never the `sqlite3` CLI. **Never run any git command against it** — an agent
  previously destroyed 2,052 rows with `git checkout`. It legitimately shows as
  modified in `git status`; that is expected, leave it alone.
- Any script that writes to the DB: read what it does first. If its own output
  is arithmetically impossible (§4.6), stop.
- Nothing has been committed, pushed or deployed, and nothing should be without
  the user asking.
