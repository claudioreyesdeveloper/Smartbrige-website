import { describe, expect, it } from "vitest"
import {
  DEFAULT_RAMP,
  MIN_QUALIFYING_BEATS,
  getRecord,
  practiceKey,
  rampTempo,
  recordPractice,
  suggestSession,
  type PracticeStore,
} from "./practice-store"

const NOW = 1_700_000_000_000

describe("recordPractice", () => {
  it("creates a record and counts the first session", () => {
    const s = recordPractice({}, {
      styleId: "funk",
      progressionId: "coast",
      tempo: 96,
      beatsPlayed: 64,
      now: NOW,
    })
    const r = getRecord(s, "funk", "coast")!
    expect(r.sessions).toBe(1)
    expect(r.lastTempo).toBe(96)
    expect(r.bestTempo).toBe(96)
    expect(r.beatsPlayed).toBe(64)
  })

  it("does NOT bank a best tempo that was barely held", () => {
    // Nudging the stepper to 200 and straight back must not record a best of
    // 200 — that is the whole point of MIN_QUALIFYING_BEATS.
    let s: PracticeStore = recordPractice({}, {
      styleId: "funk", progressionId: "coast", tempo: 96,
      beatsPlayed: 128, now: NOW,
    })
    s = recordPractice(s, {
      styleId: "funk", progressionId: "coast", tempo: 200,
      beatsPlayed: MIN_QUALIFYING_BEATS - 1, now: NOW + 1000,
    })
    expect(getRecord(s, "funk", "coast")!.bestTempo).toBe(96)
    // ...but it is still where you are now.
    expect(getRecord(s, "funk", "coast")!.lastTempo).toBe(200)
  })

  it("banks a best tempo that was genuinely held", () => {
    let s: PracticeStore = recordPractice({}, {
      styleId: "funk", progressionId: "coast", tempo: 96,
      beatsPlayed: 128, now: NOW,
    })
    s = recordPractice(s, {
      styleId: "funk", progressionId: "coast", tempo: 108,
      beatsPlayed: MIN_QUALIFYING_BEATS, now: NOW + 1000,
    })
    expect(getRecord(s, "funk", "coast")!.bestTempo).toBe(108)
  })

  it("accumulates beats and keeps progressions separate", () => {
    let s: PracticeStore = recordPractice({}, {
      styleId: "funk", progressionId: "a", tempo: 90, beatsPlayed: 32, now: NOW,
    })
    s = recordPractice(s, {
      styleId: "funk", progressionId: "a", tempo: 90, beatsPlayed: 48, now: NOW + 1,
    })
    s = recordPractice(s, {
      styleId: "funk", progressionId: "b", tempo: 90, beatsPlayed: 16, now: NOW + 2,
    })
    expect(getRecord(s, "funk", "a")!.beatsPlayed).toBe(80)
    expect(getRecord(s, "funk", "b")!.beatsPlayed).toBe(16)
    expect(practiceKey("funk", "a")).not.toBe(practiceKey("funk", "b"))
  })

  it("is pure — the input store is not mutated", () => {
    const before: PracticeStore = {}
    const after = recordPractice(before, {
      styleId: "funk", progressionId: "coast", tempo: 96,
      beatsPlayed: 64, now: NOW,
    })
    expect(before).toEqual({})
    expect(after).not.toBe(before)
  })
})

describe("rampTempo", () => {
  const cfg = { ...DEFAULT_RAMP, targetTempo: 120 }

  it("holds the start tempo until a full step has been played", () => {
    expect(rampTempo(100, 0, cfg)).toBe(100)
    expect(rampTempo(100, cfg.beatsPerStep - 1, cfg)).toBe(100)
  })

  it("steps up once per beatsPerStep", () => {
    expect(rampTempo(100, cfg.beatsPerStep, cfg)).toBe(102)
    expect(rampTempo(100, cfg.beatsPerStep * 3, cfg)).toBe(106)
  })

  it("never overshoots the target", () => {
    expect(rampTempo(100, cfg.beatsPerStep * 1000, cfg)).toBe(120)
  })

  it("never moves when the target is at or below the start", () => {
    expect(rampTempo(120, 10_000, { ...cfg, targetTempo: 120 })).toBe(120)
    expect(rampTempo(120, 10_000, { ...cfg, targetTempo: 90 })).toBe(120)
  })

  it("is monotonic in beats played", () => {
    let prev = 0
    for (let b = 0; b < cfg.beatsPerStep * 12; b += 7) {
      const t = rampTempo(100, b, cfg)
      expect(t).toBeGreaterThanOrEqual(prev)
      prev = t
    }
  })

  it("tolerates degenerate config instead of dividing by zero", () => {
    expect(rampTempo(100, 500, { ...cfg, beatsPerStep: 0 })).toBe(100)
    expect(rampTempo(100, 500, { ...cfg, stepBpm: 0 })).toBe(100)
  })
})

describe("suggestSession", () => {
  it("falls back to the style default with no history", () => {
    expect(suggestSession(null, 116)).toEqual({
      startTempo: 116,
      targetTempo: null,
    })
  })

  it("resumes at lastTempo, not bestTempo", () => {
    // You should restart where you can play, not at your record.
    const rec = {
      key: "k", styleId: "funk", progressionId: "coast",
      bestTempo: 130, lastTempo: 104, targetTempo: null,
      beatsPlayed: 1000, sessions: 4, lastPlayedAt: NOW,
    }
    expect(suggestSession(rec, 116).startTempo).toBe(104)
  })

  it("keeps an explicit target when it is still ahead", () => {
    const rec = {
      key: "k", styleId: "funk", progressionId: "coast",
      bestTempo: 110, lastTempo: 104, targetTempo: 128,
      beatsPlayed: 1000, sessions: 4, lastPlayedAt: NOW,
    }
    expect(suggestSession(rec, 116).targetTempo).toBe(128)
  })

  it("proposes a stretch above best when no target is set", () => {
    const rec = {
      key: "k", styleId: "funk", progressionId: "coast",
      bestTempo: 100, lastTempo: 100, targetTempo: null,
      beatsPlayed: 1000, sessions: 4, lastPlayedAt: NOW,
    }
    const s = suggestSession(rec, 116)
    expect(s.targetTempo).toBeGreaterThan(s.startTempo)
    expect(s.targetTempo).toBe(108)
  })
})
