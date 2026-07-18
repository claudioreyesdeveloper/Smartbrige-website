import type {
  DisplayChord,
  JamEngineClient,
  JamPrepareRequest,
  JamReharmonizeRequest,
  JamSong,
  PreparedPerformancePlan,
  ReharmonizeCandidate,
} from "../types"
import { JamEngineError } from "../types"

export type FakeEngineOptions = {
  /** Force prepare/reharmonize to fail with this code. */
  failWith?: "quota_exceeded" | "unavailable" | "network"
  latencyMs?: number
  planIdPrefix?: string
}

function msPerBeat(tempo: number): number {
  return 60_000 / tempo
}

function songDurationMs(song: JamSong, tempo: number): number {
  const beats = song.sections.reduce(
    (total, section) => total + section.bars * song.timeSignature[0],
    0,
  )
  return Math.round(beats * msPerBeat(tempo))
}

function opaqueBytes(seed: number): number[] {
  // Harmless Note On / Off pair — opaque schedule content only.
  const note = 48 + (seed % 12)
  return [0x90, note, 1, 0x80, note, 0]
}

function buildPlan(
  request: JamPrepareRequest,
  planId: string,
): PreparedPerformancePlan {
  const { song, tempo, key } = request
  const beatMs = msPerBeat(tempo)
  const sections: PreparedPerformancePlan["sections"] = {}
  const displaySections: PreparedPerformancePlan["display"]["sections"] = []
  let cursorMs = 0
  const fullEvents: PreparedPerformancePlan["full"]["events"] = []

  song.sections.forEach((section, sectionIndex) => {
    const sectionBeats = section.bars * song.timeSignature[0]
    const startMs = cursorMs
    const endMs = startMs + Math.round(sectionBeats * beatMs)
    const events = [
      {
        atMs: 0,
        target: "port1" as const,
        bytes: opaqueBytes(sectionIndex + 1),
      },
      {
        atMs: Math.max(0, endMs - startMs - 10),
        target: "port1" as const,
        bytes: opaqueBytes(sectionIndex + 20),
      },
    ]
    sections[section.id] = {
      durationMs: endMs - startMs,
      events,
      pauseSafe: false,
    }
    fullEvents.push({
      atMs: startMs,
      target: "port1",
      bytes: opaqueBytes(sectionIndex + 100),
    })
    displaySections.push({
      id: section.id,
      label: section.label,
      startMs,
      endMs,
      chords: section.chords.map((chord) => ({
        atMs: startMs + Math.round(chord.beat * beatMs),
        name: chord.name,
      })),
    })
    cursorMs = endMs
  })

  return {
    planId,
    engineVersion: "fake-1.0.0",
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    display: {
      sections: displaySections,
      tempoBpm: tempo,
      key,
      timeSignature: song.timeSignature,
    },
    full: {
      durationMs: songDurationMs(song, tempo),
      events: fullEvents,
      pauseSafe: false,
    },
    sections,
  }
}

function candidateChords(
  song: JamSong,
  flavor: "warm" | "bright" | "modal",
): Record<string, DisplayChord[]> {
  const swap: Record<"warm" | "bright" | "modal", (name: string) => string> = {
    warm: (name) => name.replace(/maj7|maj9/, "6").replace(/7$/, "9"),
    bright: (name) => name.replace(/m7|m9/, "m6").replace(/maj7/, "maj9"),
    modal: (name) => name.replace(/7$/, "7sus").replace(/maj7/, "add9"),
  }
  const mapName = swap[flavor]
  const out: Record<string, DisplayChord[]> = {}
  for (const section of song.sections) {
    out[section.id] = section.chords.map((chord) => ({
      ...chord,
      name: mapName(chord.name),
    }))
  }
  return out
}

export function createFakeEngineClient(
  options: FakeEngineOptions = {},
): JamEngineClient & { prepareCount: number; reharmonizeCount: number } {
  let prepareSeq = 0
  let reharmSeq = 0
  const latencyMs = options.latencyMs ?? 40
  const prefix = options.planIdPrefix ?? "plan"

  const client = {
    prepareCount: 0,
    reharmonizeCount: 0,

    async prepare(request: JamPrepareRequest): Promise<PreparedPerformancePlan> {
      client.prepareCount += 1
      if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs))
      if (options.failWith === "quota_exceeded") {
        throw new JamEngineError(
          "quota_exceeded",
          "Daily Jam prepare quota reached. Try again tomorrow or upgrade your plan.",
        )
      }
      if (options.failWith === "unavailable") {
        throw new JamEngineError(
          "unavailable",
          "Arrangement service is temporarily unavailable.",
        )
      }
      if (options.failWith === "network") {
        throw new JamEngineError("network", "Could not reach the arrangement service.")
      }
      if (!request.song.sections.length) {
        throw new JamEngineError("validation", "Song has no sections to prepare.")
      }
      prepareSeq += 1
      return buildPlan(request, `${prefix}_${prepareSeq}`)
    },

    async reharmonize(request: JamReharmonizeRequest) {
      client.reharmonizeCount += 1
      if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs))
      if (options.failWith === "quota_exceeded") {
        throw new JamEngineError(
          "quota_exceeded",
          "Daily reharmonization quota reached. Try again tomorrow.",
        )
      }
      if (options.failWith) {
        throw new JamEngineError(options.failWith, "Reharmonization request failed.")
      }
      reharmSeq += 1
      const generationId = `gen_${reharmSeq}`
      const flavors: Array<"warm" | "bright" | "modal"> = ["warm", "bright", "modal"]
      const candidates: ReharmonizeCandidate[] = flavors.map((flavor, index) => ({
        id: `${generationId}_c${index + 1}`,
        label: flavor === "warm" ? "Warm" : flavor === "bright" ? "Bright" : "Modal",
        chordsBySection: candidateChords(request.song, flavor),
      }))
      return { generationId, candidates }
    },
  }

  return client
}
