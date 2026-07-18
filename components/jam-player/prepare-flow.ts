import type {
  DispatchSelection,
  JamEngineClient,
  JamPrepareRequest,
  PlanDispatcher,
  PreparedPerformancePlan,
} from "./types"
import { JamEngineError } from "./types"

export type PrepareAndPlayResult =
  | { ok: true; plan: PreparedPerformancePlan }
  | { ok: false; code: string; message: string }

/**
 * UI playback path: always request a prepared plan, then hand it to the dispatcher.
 * No arranger / anticipation / reharmonization logic lives here.
 */
export async function prepareAndPlay(options: {
  engine: JamEngineClient
  dispatcher: PlanDispatcher
  request: JamPrepareRequest
  selection: DispatchSelection
  /** Skip prepare when an already-valid plan matches the current controls. */
  existingPlan?: PreparedPerformancePlan | null
  planMatchesRequest?: boolean
}): Promise<PrepareAndPlayResult> {
  const {
    engine,
    dispatcher,
    request,
    selection,
    existingPlan = null,
    planMatchesRequest = false,
  } = options

  try {
    const alreadyLoaded =
      planMatchesRequest && Boolean(dispatcher.getState().planId)

    if (alreadyLoaded) {
      dispatcher.play(selection)
      // Return a minimal opaque plan handle for callers that only need planId.
      const state = dispatcher.getState()
      return {
        ok: true,
        plan: existingPlan ?? {
          planId: state.planId!,
          engineVersion: "cached",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          display: { sections: [] },
          full: { durationMs: state.durationMs, events: [] },
          sections: {},
        },
      }
    }

    const plan = existingPlan ?? (await engine.prepare(request))
    dispatcher.loadPlan(plan)
    dispatcher.play(selection)
    return { ok: true, plan }
  } catch (error) {
    if (error instanceof JamEngineError) {
      return { ok: false, code: error.code, message: error.message }
    }
    return {
      ok: false,
      code: "unavailable",
      message: error instanceof Error ? error.message : "Could not prepare playback.",
    }
  }
}
