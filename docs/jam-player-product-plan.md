# SmartBridge Jam Player — Commercial Product Plan

**Status:** draft for review
**Date:** 2026-07-27
**Supersedes (commercially):** `jam-player-pilot.md` — that doc stays the record of the audio pilot.

---

## 1. Positioning

> **A band that does what a real band won't: play the same four bars, in your key, at your tempo, for an hour.**

Jam Player is a **practice instrument**, not a backing-track catalogue. The user picks what
*they* play, mutes it, and the rest of the band keeps going — under their complete control of
key, tempo, and loop range.

The pilot framing ("practise with a virtual band") describes the mechanic but not the value.
The value is **controllability**: repetition without fatigue, transposition without a rehearsal,
and slow-down without artifacts.

### Who it is for

The wedge is **rhythm-section players who practise alone** — bass and guitar first, drums
second. Two reasons:

1. They are the worst served today. Playing along to a finished mix with bass already in it is
   muddy; you cannot hear your own time against someone else's.
2. Their practice need is inherently *loop-shaped* — groove, feel, and time are built by
   repetition of short sections, which is exactly what a generated band is good at and a
   recording is not.

Secondary: keyboard players (the existing SmartBridge audience) and single-line instruments
(sax, trumpet, voice) that cannot self-accompany.

### Who it is not for

Players who want to learn a specific commercial song. That is Chordify / Ultimate Guitar /
Moises territory and it is a licensing business, not a product business. Do not drift into it.

---

## 2. The content asset (read this before §7)

The pilot hand-writes ~25 progressions in `lib/band-jam/progressions.ts` and hand-pins clip IDs
in `styles.ts`. That is not the scale of what exists. `SmartBridge/Resources/smartbridge.db`
(291 MB) already holds:

| Asset | Count | Why it matters |
|---|---|---|
| `roman_progression_patterns` | **2,227 distinct** usable sequences (4/8/16 bars, ≥2 chords; 2,689 rows / 2,358 unique overall) | **Roman numerals — key-independent by construction.** One row plays in all 12 keys |
| Loop-clean, bar-aligned main clips | **8,907** — guitar 6,001, drums 1,717, bass 1,114, brass 75 | Already scored: `loop_clean`, `bar_aligned`, `usable_as_main`, `section_fit_strength` |
| `drum_groove_analysis` | 8,292 clips | `groove_role` (641 main / 4,684 alt_main / 1,673 light_fill / 534 medium / 371 strong / 196 pickup / 193 ending), plus density, swing, and subdivision scores |
| `midi_clip_analysis` | per-clip | `musical_role`, `syncopation_score`, `complexity_score`, `loop_clean` |
| Genre coverage in clips | ~25 categories | Rock, Funk, Pop, Ballad, R&B, Country, Dance, Swing&Jazz, Latin, Reggae, Blues, Metal, Gospel, Fusion, World |
| Progression coverage | Pop 470, Rock 311, Movie Scores 289, Keys 278, Ballads 231, Soul 198, Acoustic 115, Country 102, Jazz 83, Gospel 67, Latin 59, Funk 57… | |
| Section classes | intro 611, chorus 499, verse 497, pre_chorus 483, bridge 148, outro 76 | **Full song forms, not just vamps** |

### Correction (2026-07-27, found during implementation)

**Every chord in `roman_progression_patterns` is `maj9` or `m9`.** All 26,901 of them, across
all 2,689 rows — two qualities, nothing else. The roman suffixes are correspondingly only `maj7`
and `7`. No dominant sevenths, no diminished, no sus, no plain triads. The table was produced by a
reharmonisation pass that applied a uniform neo-soul colouring over the source songs.

So a "Blues" progression from this table contains no dominant 7th chords, and a "Rock" progression
is all major-9ths. Shipping it as-is would make every style sound like the same smooth-jazz record.
A further ~20% of rows (521 of 2,547 candidates) have a `bars` value that disagrees with their own
duration signature and have to be dropped.

**What survives:** the *root motion* is genuine and it is the valuable part. The qualities are
synthetic and must be re-derived rather than trusted.

**The better source is `jam_chord_blocks`** — 33,706 blocks across **949 songs**. Its `chord_name`
carries the same reharmonised overlay, but its `quality` column preserves the real analysed
harmony: `maj7` 15,301 · `m7` 6,923 · `major` 6,577 · `minor` 3,268 · `7` 637 · `dim` 210 ·
`sus4` 31 · `m7(b5)` 16 · `6` 5. Confidence is 1.0 on 33,674 of 33,706 rows. It also carries
`start_bar`, `start_beat` and a variable `length_beats` — which is exactly the proportional
multi-chord-per-bar shape the chart needs, and real section labels (up to 12 per song).

**Revised approach:** build chords from `root` + `quality`, never from `chord_name`. Then chord
*voicing becomes a per-style rendering choice* — triads for Rock, dominant 7ths for Blues,
extensions for Soul, all from one harmonic skeleton. That turns a data defect into a feature, but
it is required work that was not in the original plan.

Three consequences that reshape the plan:

1. **Styles are a query, not an authoring task.** `styles.ts` pins clip IDs by hand (`55139`,
   `232595`, `4025`). With `midi_clip_analysis` and `drum_groove_analysis` those become
   *selections* — filter by category, `usable_as_main`, `loop_clean`, `section_fit_strength`.
   Ten to twelve styles stops being a content-production project and becomes a tuning problem.
   **This moves style breadth from v2 to v1.**

2. **The catalogue moat largely exists already.** The original v2 bet in §7 — user-entered progressions
   as the iReal-Pro-equivalent moat — was wrong. 2,227 key-independent progressions with section
   metadata is the moat. User chord entry demotes to a *feature* ("play my song's changes"),
   valuable but not foundational.

3. **Song-form practice is available at launch.** Because progressions carry `section_class`,
   the product can offer verse → pre-chorus → chorus forms rather than 4-bar vamps. That is what
   iReal Pro users actually practise over, and the pilot's vamp-only framing undersells it badly.

There is also an existing jam data model — `jam_songs` / `jam_chord_blocks` (33,706 blocks, with
`root`, `quality`, `chord_name`, `start_bar`, `start_beat`, `confidence`) / `jam_section_takes`.
Only 11 songs, and the pilot doc rules out reusing the SaaS jam code, but **`jam_chord_blocks` is
the right shape for a chord timeline** and should inform the schema rather than being reinvented.

---

## 3. Competitive frame

| Product | Price | Strength | Weakness we exploit |
|---|---|---|---|
| **iReal Pro** | ~$20 one-time | Enormous user-generated chart library | Sounds are widely mocked; practice controls are thin; no intensity or arrangement control |
| **Band-in-a-Box** | $99–$500 | RealTracks realism is unmatched | Desktop-only, dense legacy UI, high commitment |
| **Moises / stem splitters** | ~$4–$12/mo | Real songs, minus your part — emotionally compelling | Cannot transpose, cannot clean-loop 4 bars, artifacts when slowed |
| **Sessionband / backing-track apps** | one-time / IAP | Good audio | Fixed audio: no key, no tempo, no loop range |

**Read the middle row carefully.** Moises is the closest competitor to the "mute your part"
mechanic and it is growing fast. We will never beat it on "play along to a song you love." We
beat it on everything a *recording* cannot do: arbitrary key, arbitrary tempo, clean bar-range
looping, infinite repetition.

We will also not out-realism Band-in-a-Box's RealTracks. **Do not market on sound quality.**
Market on control and immediacy. Sound needs to be *good enough to enjoy for an hour*, which
the PSR-S900 MegaVoice material clears.

**On iReal Pro's moat specifically.** Its defensibility is a decade of user-contributed charts —
chords only, rendered by a thin GM band. Our §2 library is smaller in raw count but categorically
different: progressions carrying section roles and bar structure, paired with 8,907 analysed,
loop-clean instrument clips and per-clip groove metrics. iReal Pro can tell you the changes.
We can play them as an arrangement that responds to a form and an intensity setting. Compete
there, not on chart count — that race is already lost and does not need to be run.

---

## 4. Strategic role in the portfolio

This is the part worth being deliberate about.

**Style Maker is hardware-gated.** Its landing page says it plainly: requires a supported Yamaha
arranger. That caps its market at owners of specific keyboards — a good, monetisable niche, but
a niche, and one that cannot grow faster than Yamaha's installed base.

**Jam Player has no hardware requirement.** It is the first SmartBridge product any musician with
a browser can buy. That makes it the portfolio's **acquisition channel**, and it should be priced
and packaged as one.

The funnel that follows:

```
Jam Player (free)  →  Jam Player (paid)  →  All Access (adds Style Maker)
   mass market          practice habit         Yamaha owners self-select
```

Web MIDI output is the hinge. A Jam Player subscriber who owns a Yamaha keyboard discovers that
the same arrangement can drive their instrument — and that is the natural on-ramp to Style Maker.
Build the MIDI-out feature as much for the funnel as for the feature.

---

## 5. Packaging and pricing

### Recommendation

| Tier | Price | Contents |
|---|---|---|
| **Free** | $0, no card | 1 style, ~6 progressions, **all practice features**, no saved state |
| **Jam Player** | **$7.99/mo or $59/yr** | All styles + progressions, saved setlists, practice history, Web MIDI out |
| **All Access** | **$19.99/mo or $149/yr** | Jam Player + Style Maker |

### Why these numbers

- **$14.99 (Style Maker's price) is wrong here.** Jam Player's reference price in the buyer's
  head is iReal Pro at $20 *once*. A $15/mo subscription against that anchor loses. $7.99 reads
  as "less than a coffee a week" and survives the comparison.
- **All Access at $19.99 is the actual revenue play.** It is a $5 upsell over Style Maker alone,
  which makes it near-automatic for any Yamaha owner who tries Jam Player. Style Maker's standalone
  price stays at $14.99 and quietly becomes the *worst-value* option, which is the point.
- **Push annual hard.** Practice apps have brutal monthly churn — motivation-driven purchases
  decay on a ~6-week cycle. $59/yr is 7.4 months of monthly; the discount is worth it to convert
  a churning monthly into a committed year.

### Gate on content and memory, not on features

The free tier must include **every practice feature**: loop range, tempo control, key change,
count-in, per-part volume. Those features *are* the demonstration of value — hiding them hides
the reason to pay. Gate on **breadth** (how many styles and progressions) and **memory** (saved
setlists, practice history). Users hit those walls only after the habit has formed, which is
exactly when they convert.

**No card for free.** Style Maker requires a card at signup for its trial; that is defensible for
a high-intent hardware-owning buyer. It is fatal for a mass-market top-of-funnel product. Free
tier must be reachable without signup at all if possible — at minimum without payment details.

---

## 6. The retention loop

This is where practice apps die. Feature-complete apps with no return reason churn at 80%+ in
month one. The mechanism has to be designed, not hoped for.

**The loop: make progress visible.**

1. **Tempo-ramp trainer.** User sets a target tempo. The app steps them up across sessions and
   remembers where they are. "You played Am7–D9 at 96 last week. Try 104."
2. **Practice history per progression.** Not a generic streak — a per-item record of tempo,
   time spent, and which part they muted. This turns the catalogue into a personal curriculum.
3. **Weekly summary email.** "4 sessions this week. Your funk vamp is up from 96 to 108 bpm."

Item 1 is the single strongest retention feature in the plan and it is cheap to build once the
engine supports continuous tempo. Prioritise it accordingly.

Streaks alone are hollow. Measurable *musical* progress is not.

---

## 7. Release plan

### v1 — launch-blocking

Everything here is required before charging money.

- [ ] **Client-side audio engine.** Continuous key and tempo. See §8 — this is the gate.
- [ ] **Bar-range loop** (select bars 9–12, loop just those)
- [ ] **Count-in and metronome** (toggleable, with subdivision)
- [ ] **Per-part volume**, not just mute — replaces the current stop/restart mute
- [ ] **Chord chart synced to playback**, with the current bar highlighted
- [ ] **Free tier + paid gate + Stripe checkout**
- [ ] **Mobile-usable layout.** Practice happens with a phone on a music stand.
- [ ] **Content pipeline from `smartbridge.db`** — replace hand-written `progressions.ts` and
      hand-pinned clip IDs in `styles.ts` with a generated export from
      `roman_progression_patterns` + `midi_clip_analysis`. This is the §2 asset; without it the
      product launches at 1% of its content.
- [ ] **Style breadth, target 10–12** — a query-tuning task once the pipeline exists, not
      content authoring. *(Moved up from v2 — see §2.)*
- [ ] **Song-form playback** (verse → pre-chorus → chorus), not vamps only. The section metadata
      is already there and this is what the iReal Pro audience practises over.

### v1.1 — retention

- [ ] Tempo-ramp trainer with per-progression memory
- [ ] Practice history + weekly summary email
- [ ] Setlists (ordered groups of progressions)
- [ ] **Web MIDI output** — the Style Maker on-ramp
- [ ] **Band intensity control.** One slider, sparse → busy, driven by `drum_groove_analysis`
      densities and `complexity_score`, with `alt_main` clips (4,684 of them) as the upper range
      and automatic fill selection at section boundaries. **No competitor has this**, the data
      is already computed, and it directly serves practice: start sparse, add pressure.

### v2

- [ ] **User-entered progressions.** Chord input saved to the user's account — "play my song's
      changes." A valuable feature, but §2 corrects the earlier claim that this is the moat:
      2,227 key-independent progressions already are.
- [ ] Multiple grooves per part; per-section part variation
- [ ] Shareable practice links
- [ ] Brass parts (993 phrase pieces, 382 funky-horn clips) as a premium style dimension

### Explicitly deferred

AI solo generation, reharmonisation, audio analysis, song-catalogue licensing.

---

## 8. What has to be true technically

**Everything in §5–§7 depends on the audio engine moving into the browser.**

The pilot pre-renders one WAV pack per (style, progression, key, tempo) — 409 MB for 14 packs.
The full catalogue is roughly 3 × 25 × 12 keys × 5 tempos ≈ 4,500 packs ≈ **130 GB**, and
`public/jam-player/` is not gitignored, so it is currently on a path into the repo and the
Vercel deployment.

More importantly, the pre-render model makes the commercial plan impossible:

| Plan item | Blocked by pre-rendering |
|---|---|
| Free tier that sells the product | Tempo/key are the wow moment; they are frozen |
| Tempo-ramp trainer (the retention loop) | Requires continuous tempo |
| Bar-range loop | Requires note-level timing, not a baked mix |
| **Using the 2,227-progression library (§2)** | **Every progression × 12 keys × N tempos × 29 MB. This is the fatal one** |
| Band intensity control | Requires per-part clip substitution at play time |
| "No dead combinations" | `"Not rendered yet"` is a broken control in a paid app |

The fourth row is the one that decides it. The library in §2 is stored as **roman numerals** —
key-independent by design. Pre-rendering takes an asset whose defining property is that it works
in any key and freezes it into one key per 29 MB file. At 2,227 progressions × 12 keys that is
roughly **780 TB**. The content asset and the pre-render architecture are fundamentally
incompatible; the engine has to resolve roman numerals to pitches at play time, which is exactly
what a client-side engine does for free.

**Direction:** ship the sample set once as compressed keymaps (~15–30 MB, cached after first
visit), port the arrangement logic from `scripts/band_jam_pilot/render_stems.py` — `tile_events`,
`adapt_harmonic`, `fold_to_register`, and the MegaVoice-above-83 rule — to TypeScript, and drive
an AudioWorklet sampler. Key and tempo then cost nothing, and a new progression is a few KB of
JSON.

The pilot did its job: it validated the musical adaptation and the sound. It should not ship.

**Keep the instrument layer swappable.** Sample sourcing is settled per your confirmation, but the
engine should still address instruments by role (`bass`, `drums`, `guitar`, `solo`) with the sample
set behind an interface, so a future library change is a config swap rather than a rewrite. Worth
committing the licence terms to the repo so the basis is on record.

---

## 9. Entitlement changes required

`lib/db/schema.ts` defines `subscriptions` with `userId` **unique** — one subscription per user.
Adding a second paid product breaks that assumption.

**Recommendation: plan tiers on the existing row, not multiple rows.**

Add a `plan` column (`style_maker` | `jam_player` | `all_access`) and derive entitlements from it:

```ts
const ENTITLEMENTS = {
  style_maker: ["style-maker"],
  jam_player:  ["jam-player"],
  all_access:  ["style-maker", "jam-player"],
} as const
```

Why tiers rather than one row per product:

- Keeps `userId` unique — no migration of the existing constraint or the webhook logic.
- Makes All Access a **plan change** in Stripe (proration handled natively) rather than a second
  concurrent subscription, which would mean two invoices, two renewal dates, and two cancellation
  flows.
- Upgrade/downgrade stays a single `stripePriceId` swap.

Then generalise `lib/style-maker/entitlements.ts` into a shared `lib/billing/` module — the current
`userHasActiveSubscription` shape is right, it just needs a product argument. Note the dev bypass
at `entitlements.ts:38` returns `true` for any signed-in user when Stripe is unconfigured; that
needs to stay strictly development-only as a second product lands.

---

## 10. Metrics

Instrument these from day one — the plan above is a set of hypotheses and these are the tests.

**Activation** (the free tier's job)
- % of visitors who reach audible playback
- % who mute a part (the core mechanic — if this is low, the pitch is unclear)
- % who change tempo or key (the differentiator vs. backing tracks)

**Retention** (the business)
- D1 / D7 / D30 return rate
- Sessions per week per active user
- % of users with ≥3 sessions on the *same* progression — the practice signal

**Revenue**
- Free → paid conversion, and which wall triggered it (content breadth vs. saved state)
- Annual share of new subscriptions
- Jam Player → All Access upgrade rate (the funnel thesis in §4)

**The one number that matters:** week-4 retention of free users. If musicians do not come back
in week 4 without paying, no pricing change will save it.

---

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Engine port is larger than estimated | High | Spike one instrument end-to-end before committing to the full port |
| Sound quality judged against Band-in-a-Box | Medium | Never market on realism; market on control (§3) |
| Mobile browser audio (iOS autoplay, latency) | High | Test on real iOS early — practice is a phone-on-a-stand activity |
| ~~Content breadth too thin at launch~~ | **Resolved** | §2 — the library already exists; the risk is the *pipeline* to expose it, not the content |
| Progression library quality is uneven | Medium | 2,227 rows are machine-derived; needs a curation/scoring pass before they face users. Budget for it |
| Clip-selection queries produce unmusical style combinations | Medium | Style definitions become queries (§2) — needs listening QA, not just filters that return rows |
| Practice-app churn | High | §6 retention loop; annual pricing; ramp trainer before launch+1 |
| Cannibalising Style Maker | Low | All Access is a $5 upsell, not a substitute — Jam Player feeds it |

---

## 12. Immediate next steps

1. **Add `public/jam-player/stems/` to `.gitignore`** before 409 MB reaches git history.
   Thirty seconds, and it gets more expensive every day it waits.
2. **Decide packaging** (§5) — the pricing and the `plan` column depend on it.
3. **Spike the client-side sampler** — one instrument, arbitrary key/tempo, on desktop and iOS.
   This de-risks the largest item in the plan and it is a day or two of work.
4. **Audit the progression library.** Take a sample of `roman_progression_patterns`, render them,
   and listen. The count is impressive; the question is what fraction is musically usable
   without curation. This number determines whether §2's conclusions hold, so establish it early.
5. **Generalise entitlements** into `lib/billing/` while there is only one consumer.
6. Then build v1 (§7) against the engine.

### On sequencing

Steps 3 and 4 are the two genuine unknowns and they are independent — the sampler spike is an
engineering risk, the library audit is a content risk. Both are cheap. Neither should wait on the
other, and both should complete before any v1 work starts, because either one coming back negative
changes the plan rather than delaying it.
