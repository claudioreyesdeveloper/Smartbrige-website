import { describe, expect, it } from "vitest"
import {
  createFakeEngineClient,
  createFakePlanDispatcher,
  FIXTURE_SONGS,
} from "@/components/jam-player/fakes"
import { prepareAndPlay } from "@/components/jam-player/prepare-flow"

describe("prepareAndPlay", () => {
  it("requests a prepared plan before handing it to the dispatcher", async () => {
    const engine = createFakeEngineClient({ latencyMs: 0 })
    const dispatcher = createFakePlanDispatcher({ intervalMs: 10_000 })
    const song = FIXTURE_SONGS[0]

    const result = await prepareAndPlay({
      engine,
      dispatcher,
      request: {
        model: "genos",
        song,
        key: song.key,
        tempo: song.tempo,
        styleId: "style-easypop",
        loop: false,
      },
      selection: { mode: "full" },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(engine.prepareCount).toBe(1)
    expect(dispatcher.loadedPlan?.planId).toBe(result.plan.planId)
    expect(dispatcher.playCount).toBe(1)
    expect(dispatcher.getState().status).toBe("playing")
    expect(dispatcher.getState().planId).toBe(result.plan.planId)
  })

  it("reuses a loaded plan without a second prepare when fingerprint matches", async () => {
    const engine = createFakeEngineClient({ latencyMs: 0 })
    const dispatcher = createFakePlanDispatcher({ intervalMs: 10_000 })
    const song = FIXTURE_SONGS[0]
    const request = {
      model: "genos" as const,
      song,
      key: song.key,
      tempo: song.tempo,
      styleId: "style-easypop",
      loop: false,
    }

    const first = await prepareAndPlay({
      engine,
      dispatcher,
      request,
      selection: { mode: "full" },
    })
    expect(first.ok).toBe(true)

    dispatcher.stop()

    const second = await prepareAndPlay({
      engine,
      dispatcher,
      request,
      selection: { mode: "section", sectionId: song.sections[0].id },
      planMatchesRequest: true,
    })

    expect(second.ok).toBe(true)
    expect(engine.prepareCount).toBe(1)
    expect(dispatcher.playCount).toBe(2)
    expect(dispatcher.getState().selection).toEqual({
      mode: "section",
      sectionId: song.sections[0].id,
    })
  })

  it("surfaces quota errors without loading a plan", async () => {
    const engine = createFakeEngineClient({
      latencyMs: 0,
      failWith: "quota_exceeded",
    })
    const dispatcher = createFakePlanDispatcher()
    const song = FIXTURE_SONGS[0]

    const result = await prepareAndPlay({
      engine,
      dispatcher,
      request: {
        model: "genos",
        song,
        key: song.key,
        tempo: song.tempo,
        styleId: "style-easypop",
        loop: false,
      },
      selection: { mode: "full" },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe("quota_exceeded")
    expect(dispatcher.loadedPlan).toBeNull()
    expect(dispatcher.playCount).toBe(0)
  })
})
