# Archived: stem-based Jam Player pilot

> Retired after the event-based Jam Player shipped. The source files named in this document were removed because no active route imported them. The current implementation starts at `app/jam-player/app/page.tsx` and `components/band-jam/practice-screen.tsx`.

# SmartBridge Jam Player — Pilot

**Status:** local pilot (Option A audio)
**Date:** 2026-07-27
**Repos:**
- Product: `/Users/claudio/Developer/Smartbridge-website`
- Renderer: `/Users/claudio/Developer/Smartbridge/scripts/band_jam_pilot`

This is a **new** product. It does **not** reuse the old `/demo/jam-player` demo or the SaaS Jam worktree (`release-worktrees/composer-saas/i05`).

---

## Goal

A web Jam Player where musicians practise with a configurable virtual band built from SmartBridge’s existing libraries.

Not a backing-track player: the user chooses which instrument **they** play, mutes that part, and plays along with the rest of the band.

**Success criterion:** musicians come back because they can quickly pick a progression, mute their instrument, and practise with a complete virtual band.

---

## Pilot scope (in)

- 3 styles (Funk, Pop, Ballad)
- ~25 curated chord progressions
- Key + tempo controls
- Loop
- Per-part mute (drums / bass / guitar / solo)
- Browser playback of **pre-rendered WAV stems**
- Arrangement: section-aware drums + bass; one guitar clip reused for the whole progression (pilot simplification)

## Pilot scope (out)

- Editing
- AI generation
- New musical libraries
- On-demand server render on Vercel (sfizz does not run there)
- Web MIDI out (optional later)
- Reusing old Jam Player UI / scheduler / factory-song catalog

---

## Audio approach: Option A (Kontakt / PSR-S900)

Kontakt cannot run in the browser. For this pilot:

1. **Assemble** MIDI parts from SmartBridge `midi_clips` + progression chords (root-following adaptation for harmonic parts).
2. **Render** each part through converted Yamaha PSR-S900 SFZ instruments with `sfizz_render`.
3. **Serve** stems as static WAVs under the website `public/` tree.
4. **Play** in the browser with Web Audio; **mute = do not play that stem**.

### Sound source

Converted NKIs from:

`/Volumes/Second/KontaktLib/Yamaha PSR S900`

SFZs used (from the June `prototype/` conversion):

| Part   | SFZ |
|--------|-----|
| Drums  | `prototype/converted/014_StandardKit1_oneshot.sfz` (patched) |
| Bass   | `prototype/converted/024_ElectricBass MegaVoice.sfz` |
| Guitar | `prototype/converted/077_SolidGuitar1 MegaVoice.sfz` |
| Solo   | same SolidGuitar1 MegaVoice (chorus phrase) |

**Drum SFZ (2026-07-27):** The Kontakt PSR-S900 `StandardKit1` conversion is **not GM-aligned** — MIDI 36/38/42 played cymbals/wrong voices. `014_StandardKit1_gm.sfz` remaps GM kick/snare/hats onto the correct samples (built by `scripts/band_jam_pilot/build_gm_drum_sfz.py`). Also forces one-shots and strips broken velocity splits.

Tooling: `prototype/tools/sfizz-1.2.3-macos/.../sfizz_render`
(Original conversion used ConvertWithMoss on the Kontakt library.)

### Batch render

```bash
cd /Users/claudio/Developer/Smartbridge
python3 scripts/band_jam_pilot/batch_render.py
```

Writes stems under `Smartbridge-website/public/jam-player/stems/` and refreshes `lib/band-jam/packs.generated.json` (14 packs in the first test batch).

### Why not SoundFonts / live Web MIDI?

- Generic GM SoundFonts would not match the PSR-S900 MegaVoice sound already validated in the prototype.
- Style Maker’s site path is Web MIDI → Yamaha keyboard; this pilot needs browser-only practise without requiring a keyboard.

---

## What was built

### Website (`Smartbridge-website`)

| Path | Role |
|------|------|
| `app/jam-player/page.tsx` | Landing |
| `app/jam-player/app/page.tsx` | Practice app |
| `components/band-jam/band-jam-landing.tsx` | Landing UI |
| `components/band-jam/band-jam-app.tsx` | Style / progression / key / tempo / mute / play |
| `lib/band-jam/types.ts` | Shared types |
| `lib/band-jam/styles.ts` | 3 styles + pinned clip IDs + SFZ names |
| `lib/band-jam/progressions.ts` | ~25 progressions |
| `lib/band-jam/catalog.ts` | Catalog + list of **rendered** packs |
| `lib/band-jam/stem-player.ts` | Multi-stem Web Audio player |
| `public/jam-player/stems/<packId>/` | Pre-rendered WAV stems |
| `components/site-header.tsx` | Nav link: **Jam Player** |

Code folders are named `band-jam` on purpose so nothing accidentally imports old `components/demo/jam-player-*` or `lib/demo/jam-scheduler.ts`.

### Offline renderer (`Smartbridge`)

| Path | Role |
|------|------|
| `scripts/band_jam_pilot/render_stems.py` | Assemble + sfizz render → website `public/` |
| `scripts/band_jam_pilot/catalog_data.py` | Python mirror of style/progression data for the renderer |

### First rendered pack

```
funk__am7-d9-vamp__k9__t116
```

- Style: Funk
- Progression: Am7 – D9 vamp
- Key: A (pc 9)
- Tempo: 116
- Parts: drums, bass, guitar, solo (~42s each)

Other style / progression / key / tempo combinations show **“Not rendered yet”** until the script is run for that pack and `RENDERED_PACKS` in `catalog.ts` is updated.

---

## How to test

```bash
cd /Users/claudio/Developer/Smartbridge-website
npm run dev
```

Open:

- Landing: http://localhost:3000/jam-player
- App: http://localhost:3000/jam-player/app

Leave the default **Funk · Am7 – D9 vamp · A · 116**, press **Play**, mute the part you will play. Solo starts muted by default.

---

## How to render more packs

From the SmartBridge repo (needs local `smartbridge.db`, sfizz, and `prototype/converted` SFZs):

```bash
cd /Users/claudio/Developer/Smartbridge

python3 scripts/band_jam_pilot/render_stems.py \
  --style funk \
  --progression am7-d9-vamp \
  --key 9 \
  --tempo 116
```

Output:

`../Smartbridge-website/public/jam-player/stems/<style>__<progression>__k<pc>__t<tempo>/`

Then add/update the pack entry in:

`Smartbridge-website/lib/band-jam/catalog.ts` → `RENDERED_PACKS`

(Pop / Ballad styles are defined in the UI catalog; extend `catalog_data.py` the same way before rendering them.)

---

## Arrangement notes (pilot)

- **Drums / bass:** section slots (intro / verse / chorus / bridge) from SmartBridge library clip IDs.
- **Guitar:** one clip reused for the whole progression (`reuseClipId`), as specified for the pilot.
- **Solo:** optional; Funk pack uses a chorus guitar phrase; muted by default in the UI.
- **Harmony:** pitched notes transpose by chord root; MegaVoice FX notes above MIDI 83 are left alone.
- **Key control:** transposition is applied at **render** time. Changing key/tempo in the UI only plays if a matching stem pack exists.

---

## Related prior work (not used by this product)

| Location | Notes |
|----------|--------|
| `Smartbridge/prototype/` | Original PSR-S900 SFZ band demo (`make_band_demo.py`, `style_assembler.py`) — inspiration for Option A |
| `Smartbridge-website/app/demo/jam-player` | Marketing demo (Web MIDI to keyboard) — **do not reuse** |
| `release-worktrees/composer-saas/i05` | Full Jam SaaS (factory songs / reharm) — **do not reuse** for this pilot |

---

## Next steps (after validation)

1. Pre-render a small matrix (3 styles × priority progressions × a few keys/tempos).
2. Keep `catalog_data.py` and TS styles/progressions in sync (or generate one from the other).
3. Optional: background render worker for on-demand packs (still Option A, not in-browser SFZ).
4. Optional: Web MIDI output of the same arrangement for keyboard users.
5. Later product features (explicitly not pilot): multiple grooves per part, AI solos, analysis, reharmonization.
