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

  let offset = 0
  for (const section of sections) {
    const duration = section.endMs - section.startMs
    const local = selection?.mode === "section" ? positionMs : positionMs - section.startMs
    const inSection =
      selection?.mode === "section"
        ? positionMs >= 0 && positionMs < duration
        : positionMs >= section.startMs && positionMs < section.endMs

    if (!inSection) {
      offset += duration
      continue
    }

    const chords = section.chords ?? []
    let chord = chords[0]?.name ?? ""
    for (const entry of chords) {
      const at = selection?.mode === "section" ? entry.atMs - section.startMs : entry.atMs
      if (at <= (selection?.mode === "section" ? positionMs : positionMs)) {
        chord = entry.name
      }
    }
    return { chord, sectionLabel: section.label }
  }

  void offset
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
    if (selection.mode === "full") return plan.full.durationMs
    return plan.sections[selection.sectionId]?.durationMs ?? 0
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
        durationMs: next.full.durationMs,
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
      if (selection.mode === "section" && !plan.sections[selection.sectionId]) {
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
        durationMs: plan?.full.durationMs ?? 0,
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
