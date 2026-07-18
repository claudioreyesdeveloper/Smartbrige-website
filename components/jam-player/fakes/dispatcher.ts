import type {
  DispatchPlaybackState,
  DispatchSelection,
  PlanDispatcher,
  PreparedPerformancePlan,
} from "../types"

export type FakeDispatcherOptions = {
  /** Advance position automatically while playing (ms per tick). */
  tickMs?: number
  /** Interval between ticks. */
  intervalMs?: number
}

function idleState(): DispatchPlaybackState {
  return {
    status: "idle",
    planId: null,
    selection: null,
    positionMs: 0,
    durationMs: 0,
    currentChord: "",
    currentSectionLabel: "",
    error: null,
  }
}

function chordAt(
  plan: PreparedPerformancePlan,
  positionMs: number,
  selection: DispatchSelection | null,
): { chord: string; sectionLabel: string } {
  const sections =
    selection?.mode === "section"
      ? plan.display.sections.filter((s) => s.id === selection.sectionId)
      : plan.display.sections

  const msPerBar =
    (60_000 / plan.display.tempoBpm) *
    plan.display.timeSignature.numerator *
    (4 / plan.display.timeSignature.denominator)
  for (const section of sections) {
    const startMs = section.startBar * msPerBar
    const duration = section.barCount * msPerBar
    const inSection =
      selection?.mode === "section"
        ? positionMs >= 0 && positionMs < duration
        : positionMs >= startMs && positionMs < startMs + duration

    if (!inSection) continue

    const absoluteBar =
      section.startBar + (selection?.mode === "section" ? positionMs : positionMs - startMs) / msPerBar
    let chord = ""
    for (const entry of plan.display.chords) {
      if (entry.startBar <= absoluteBar) {
        chord = entry.symbol
      }
    }
    return { chord, sectionLabel: section.name }
  }

  return { chord: "", sectionLabel: "" }
}

export function createFakePlanDispatcher(
  options: FakeDispatcherOptions = {},
): PlanDispatcher & { loadedPlan: PreparedPerformancePlan | null; playCount: number } {
  const tickMs = options.tickMs ?? 250
  const intervalMs = options.intervalMs ?? 100
  let plan: PreparedPerformancePlan | null = null
  let state = idleState()
  let timer: ReturnType<typeof setInterval> | null = null
  const listeners = new Set<(state: DispatchPlaybackState) => void>()

  const emit = () => {
    for (const listener of listeners) listener({ ...state })
  }

  const clearTimer = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const resolveDuration = (selection: DispatchSelection): number => {
    if (!plan) return 0
    if (selection.mode === "full") return plan.display.durationMs
    const section = plan.display.sections.find((item) => item.id === selection.sectionId)
    if (!section) return 0
    const beatsPerBar =
      plan.display.timeSignature.numerator * (4 / plan.display.timeSignature.denominator)
    return section.barCount * beatsPerBar * (60_000 / plan.display.tempoBpm)
  }

  const api = {
    loadedPlan: null as PreparedPerformancePlan | null,
    playCount: 0,

    loadPlan(next: PreparedPerformancePlan) {
      clearTimer()
      plan = next
      api.loadedPlan = next
      state = {
        ...idleState(),
        status: "ready",
        planId: next.planId,
        durationMs: next.display.durationMs,
      }
      emit()
    },

    play(selection: DispatchSelection) {
      if (!plan) {
        state = {
          ...idleState(),
          status: "error",
          error: "No prepared plan loaded.",
        }
        emit()
        return
      }
      if (selection.mode === "section" && !plan.dispatch.sections[selection.sectionId]) {
        state = {
          ...state,
          status: "error",
          error: "Section plan missing from prepared plan.",
        }
        emit()
        return
      }
      api.playCount += 1
      clearTimer()
      const durationMs = resolveDuration(selection)
      const live = chordAt(plan, 0, selection)
      state = {
        status: "playing",
        planId: plan.planId,
        selection,
        positionMs: 0,
        durationMs,
        currentChord: live.chord,
        currentSectionLabel: live.sectionLabel,
        error: null,
      }
      emit()

      timer = setInterval(() => {
        if (!plan || state.status !== "playing") return
        const nextPos = Math.min(state.durationMs, state.positionMs + tickMs)
        const liveChord = chordAt(plan, nextPos, state.selection)
        if (nextPos >= state.durationMs) {
          clearTimer()
          state = {
            ...state,
            status: "completed",
            positionMs: state.durationMs,
            currentChord: liveChord.chord,
            currentSectionLabel: liveChord.sectionLabel,
          }
          emit()
          return
        }
        state = {
          ...state,
          positionMs: nextPos,
          currentChord: liveChord.chord,
          currentSectionLabel: liveChord.sectionLabel,
        }
        emit()
      }, intervalMs)
    },

    stop() {
      clearTimer()
      state = {
        ...state,
        status: plan ? "stopped" : "idle",
        positionMs: 0,
        currentChord: "",
        currentSectionLabel: "",
        selection: null,
        error: null,
      }
      emit()
    },

    panic() {
      clearTimer()
      state = {
        ...idleState(),
        status: plan ? "ready" : "idle",
        planId: plan?.planId ?? null,
        durationMs: plan?.display.durationMs ?? 0,
      }
      emit()
    },

    getState() {
      return { ...state }
    },

    subscribe(listener: (next: DispatchPlaybackState) => void) {
      listeners.add(listener)
      listener({ ...state })
      return () => listeners.delete(listener)
    },
  }

  return api
}
