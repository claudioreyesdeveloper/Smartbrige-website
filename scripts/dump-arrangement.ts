/**
 * Dump what the arranger ACTUALLY produces, as MIDI.
 *
 * Written because the guitar kept sounding an octave high and every attempt to
 * diagnose it from the catalogue metadata was wrong. This runs the real
 * `arrange()` — the same code the browser runs — and writes the resulting note
 * events out, so the output can be opened in a DAW and looked at directly
 * rather than reasoned about.
 *
 *   npx tsx scripts/dump-arrangement.ts --style rock --variation 0
 *
 * Writes <out>/<style>__var<N>__<part>.json plus a summary; a companion Python
 * step turns those into .mid files.
 */
import { writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { arrange } from "@/lib/band-jam/engine/arrange"
import type {
  BandStyle,
  NoteEvent,
  Progression,
} from "@/lib/band-jam/engine/types"

type ClipJson = Record<string, { sourceKeyPc: number; events: NoteEvent[] }>

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

async function main() {
  const styleId = arg("style", "rock")
  const variation = Number(arg("variation", "0"))
  const progIndex = Number(arg("progression", "0"))
  const outDir = arg("out", "/tmp/jam-dump")

  const cat = (await import("@/lib/band-jam/catalog.generated.json")) as unknown as {
    default?: { progressions: Progression[]; styles: BandStyle[] }
    progressions: Progression[]
    styles: BandStyle[]
  }
  const clipRaw = (await import("@/lib/band-jam/clips.generated.json")) as unknown as {
    default?: ClipJson
  } & ClipJson

  const catalog = cat.default ?? cat
  const rawClips = (clipRaw.default ?? clipRaw) as ClipJson

  const clips = new Map<number, { events: NoteEvent[]; sourceKeyPc: number }>()
  for (const [id, v] of Object.entries(rawClips)) {
    clips.set(Number(id), { events: v.events, sourceKeyPc: v.sourceKeyPc })
  }

  const style = catalog.styles.find((s) => s.id === styleId)
  if (!style) throw new Error(`unknown style ${styleId}`)
  const progression = catalog.progressions[progIndex]

  const out = arrange({
    style,
    progression,
    keyPc: progression.keyPc,
    tempo: style.tempoDefault,
    clips,
    variation,
  })

  mkdirSync(outDir, { recursive: true })
  const summary: Record<string, unknown> = {
    style: styleId,
    variation,
    progression: progression.name,
    keyPc: progression.keyPc,
    keyLabel: progression.keyLabel,
    tempo: style.tempoDefault,
    totalBars: out.totalBars,
    sections: out.sections.map((s) => ({
      role: s.role,
      label: s.label,
      startBar: s.startBar,
      endBar: s.endBar,
    })),
    parts: {},
  }

  for (const p of out.parts) {
    const def = style.parts[p.part]
    const pitched = p.events.filter((e) => e.note <= 83).map((e) => e.note)
    const fx = p.events.filter((e) => e.note > 83).map((e) => e.note)
    ;(summary.parts as Record<string, unknown>)[p.part] = {
      instrument: def?.instrument,
      harmonic: def?.harmonic,
      register: def?.register,
      slotClipIds: def?.slots,
      noteCount: p.events.length,
      pitchedRange: pitched.length
        ? [Math.min(...pitched), Math.max(...pitched)]
        : null,
      fxRange: fx.length ? [Math.min(...fx), Math.max(...fx)] : null,
      // The source clips BEFORE arrange touched them, so any transposition or
      // register folding shows up as a difference against pitchedRange.
      sourceRange: (() => {
        const ids = Object.values(def?.slots ?? {}).filter(
          (v): v is number => typeof v === "number",
        )
        const src = ids
          .flatMap((id) => clips.get(id)?.events ?? [])
          .filter((e) => e.note <= 83)
          .map((e) => e.note)
        return src.length ? [Math.min(...src), Math.max(...src)] : null
      })(),
    }
    writeFileSync(
      path.join(outDir, `${styleId}__var${variation}__${p.part}.json`),
      JSON.stringify({ tempo: style.tempoDefault, events: p.events }, null, 1),
    )
  }

  writeFileSync(
    path.join(outDir, `${styleId}__var${variation}__summary.json`),
    JSON.stringify(summary, null, 2),
  )
  console.log(JSON.stringify(summary, null, 2))
}

void main()
