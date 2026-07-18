import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { applyAccessFixture } from "./helpers/access-fixture"

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop-only paid workspace")
  await applyAccessFixture(page, {
    userId: "fixture-user",
    email: "fixture@example.com",
    entitlements: [
      { serviceKey: "jam-player", status: "active" },
      { serviceKey: "genos-mixer", status: "active" },
      { serviceKey: "bass-drums", status: "active" },
    ],
  })
  await page.addInitScript(() => {
    const input1 = {
      id: "in1",
      name: "Yamaha Genos Port 1",
      manufacturer: "Yamaha",
      state: "connected",
      onmidimessage: null as null | ((event: { data: Uint8Array }) => void),
      open: async () => undefined,
      close: async () => undefined,
    }
    const input2 = { ...input1, id: "in2", name: "Yamaha Genos Port 2" }
    const output = (id: string, name: string) => ({
      id,
      name,
      manufacturer: "Yamaha",
      state: "connected",
      open: async () => undefined,
      close: async () => undefined,
      send: (data: Uint8Array | number[]) => {
        const win = window as typeof window & { __rhythmMidiSendCount?: number }
        win.__rhythmMidiSendCount = (win.__rhythmMidiSendCount ?? 0) + 1
        const bytes = Array.from(data)
        if (bytes[0] === 0xf0 && bytes[1] === 0x7e) {
          setTimeout(() => input1.onmidimessage?.({
            data: Uint8Array.from([
              0xf0, 0x7e, 0x7f, 0x06, 0x02, 0x43, 0x7f, 0x68, 0x00, 0x00, 0xf7,
            ]),
          }), 0)
        }
      },
    })
    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: async () => ({
        inputs: new Map([[input1.id, input1], [input2.id, input2]]),
        outputs: new Map([
          ["out1", output("out1", "Yamaha Genos Port 1")],
          ["out2", output("out2", "Yamaha Genos Port 2")],
        ]),
        onstatechange: null,
      }),
    })
  })

  const now = "2026-07-18T12:00:00.000Z"
  let revision = "rev_rhythm_1"
  let version = 1
  let document = {
    schemaVersion: 1,
    song: {
      title: "Coastal Drive",
      tempo: 112,
      key: "C",
      sections: [
        {
          id: "verse",
          name: "Verse",
          stylePart: "mainA",
          bars: 4,
          chords: [{ symbol: "C", startBeat: 0, durationBeats: 16 }],
        },
        {
          id: "chorus",
          name: "Chorus",
          stylePart: "mainC",
          bars: 4,
          chords: [
            { symbol: "F", startBeat: 0, durationBeats: 6 },
            { symbol: "G", startBeat: 6, durationBeats: 2 },
            { symbol: "C", startBeat: 8, durationBeats: 8 },
          ],
        },
      ],
    },
  }
  const project = () => ({
    id: "proj_rhythm_1",
    title: "Coastal Drive",
    revisionId: revision,
    version,
    document,
    createdAt: now,
    updatedAt: now,
  })
  await page.route("**/api/projects", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        projects: [{
          id: "proj_rhythm_1",
          title: "Coastal Drive",
          currentRevisionId: revision,
          currentVersion: version,
          createdAt: now,
          updatedAt: now,
        }],
      }),
    })
  })
  await page.route("**/api/projects/proj_rhythm_1", async (route) => {
    if (route.request().method() === "PUT") {
      const request = route.request().postDataJSON() as { document: typeof document }
      document = request.document
      version += 1
      revision = `rev_rhythm_${version}`
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ project: project() }),
    })
  })
  await page.route("**/api/engine/rhythm/options", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        genres: ["Pop"],
        sectionTypes: ["Chorus"],
        feels: ["Straight 8ths"],
      }),
    })
  })
  await page.route("**/api/engine/rhythm/query", async (route) => {
    const request = route.request().postDataJSON() as {
      kind: "bass" | "drums"
      mode: "browse" | "suggested"
    }
    const bass = {
      candidateId: "bass_lift_02",
      label: "Melodic Lift 02",
      category: "Pop",
      feel: "Straight 8ths",
      sectionType: "Chorus",
      bpm: 112,
      bars: 4,
      matchBand: "strong",
      qualityBand: "high",
    }
    const drums = {
      candidateId: "drums_chorus_02",
      label: "Open Chorus 02",
      category: "Pop",
      feel: "Straight 8ths",
      sectionType: "Chorus",
      bpm: 112,
      bars: 4,
      matchBand: "strong",
      qualityBand: "high",
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        queryId: request.mode === "suggested" ? "query_suggested" : "query_browse",
        expiresAt: "2099-01-01T00:00:00.000Z",
        candidates: [request.kind === "bass" ? bass : drums],
      }),
    })
  })
  await page.route("**/api/engine/rhythm/fills", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        queryId: "query_fills",
        expiresAt: "2099-01-01T00:00:00.000Z",
        fills: [{
          candidateId: "fill_compact_turn",
          label: "Compact Turn",
          feel: "Straight 8ths",
          bars: 1,
        }],
      }),
    })
  })
  await page.route("**/api/engine/rhythm/render", async (route) => {
    const request = route.request().postDataJSON() as {
      operation: "audition" | "apply"
      part?: "bass" | "drums" | "fill"
      bassCandidateId?: string
      drumCandidateId?: string
    }
    const parts = request.operation === "audition"
      ? [request.part!]
      : [
          ...(request.bassCandidateId ? ["bass" as const] : []),
          ...(request.drumCandidateId ? ["drums" as const] : []),
        ]
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        renders: parts.map((part) => ({
          renderReferenceId: `render_${part}`,
          recipeReferenceId: `recipe_${part}`,
          part,
          durationMs: 8_000,
          renderedSmf: "TVRoZAAAAAYAAQABA8BNVHJrAAAABAD/LwA=",
          playback: part === "bass"
            ? {
                channel: 11,
                kind: "mega-voice",
                label: "Mega Bass",
                bankMsb: 8,
                bankLsb: 0,
                programYamaha: 18,
              }
            : {
                channel: 10,
                kind: "channel-current",
                label: "Drum channel",
                bankMsb: null,
                bankLsb: null,
                programYamaha: null,
              },
        })),
      }),
    })
  })
})

test("section to bass, audition, suggested drums, fill, and Apply to Song", async ({
  page,
}) => {
  const renderRequests: Array<Record<string, unknown>> = []
  page.on("request", (request) => {
    if (request.url().endsWith("/api/engine/rhythm/render")) {
      renderRequests.push(request.postDataJSON() as Record<string, unknown>)
    }
  })
  await page.goto("/app/jam-player/bass")

  await expect(page.getByRole("heading", { name: "Bass & Drums", level: 1 })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "SmartBridge services" })).toBeVisible()
  await expect(page.locator(".app-shell-sidebar")).toHaveCount(0)
  await expect(page.getByRole("tab", { name: "Bass Performance" })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await expect(page.getByRole("tab", { name: "Drum Performance" })).toBeVisible()
  await expect(page.getByText("Rhythm Guitar")).toHaveCount(0)
  await expect(page.getByText("Brass Performance")).toHaveCount(0)

  await page.getByLabel("Song section").selectOption({ label: "Chorus" })
  await expect(page.getByText("Updated for this chord context")).toBeVisible()

  await page.getByLabel("Genre").selectOption("Pop")
  await page.getByLabel("Section", { exact: true }).selectOption("Chorus")
  await page.getByLabel("Feel").selectOption("Straight 8ths")
  await expect(page.getByText("1 result")).toBeVisible()
  expect(renderRequests).toEqual([])

  const bass = page.getByRole("option", { name: /Melodic Lift 02/ })
  await bass.dblclick()
  await expect(page.getByText("Playing Melodic Lift 02")).toBeVisible()
  expect(renderRequests).toHaveLength(1)
  expect(renderRequests[0]).toMatchObject({
    operation: "audition",
    part: "bass",
    candidateId: "bass_lift_02",
  })
  await page.getByRole("button", { name: "Stop", exact: true }).click()
  await expect(page.locator(".rhythm-status-light")).toHaveClass(/is-stopped/)
  expect(await page.evaluate(
    () => (window as typeof window & { __rhythmMidiSendCount?: number }).__rhythmMidiSendCount,
  )).toBeGreaterThan(0)

  await page.getByRole("tab", { name: "Drum Performance" }).click()
  const suggested = page.getByRole("button", { name: "Suggested drums" })
  await expect(suggested).toBeEnabled()
  await suggested.click()
  await expect(page.getByText("Suggested drums updated for this chord context")).toBeVisible()

  await page.getByRole("option", { name: /Open Chorus 02/ }).click()
  const fill = page.getByRole("option", { name: /Compact Turn/ })
  await expect(fill).toBeVisible()
  await fill.click()
  await page.getByRole("button", { name: "Assign selected fill to bar 4" }).click()
  await expect(
    page.getByRole("button", { name: "Assign selected fill to bar 4" }),
  ).toContainText("Compact Turn")

  const saveRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/projects/proj_rhythm_1") &&
      request.method() === "PUT",
  )
  await page.getByRole("button", { name: "Apply to Song" }).click()
  const saveBody = (await saveRequest).postDataJSON() as {
    document: {
      bass: Record<string, unknown>
      drums: Record<string, unknown>
    }
  }
  expect(saveBody.document.bass).toEqual({
    sourceId: "recipe_bass",
    engineVersion: "opaque-rhythm-v1",
    renderBlobId: "render_bass",
  })
  expect(saveBody.document.drums).toEqual({
    sourceId: "recipe_drums",
    engineVersion: "opaque-rhythm-v1",
    renderBlobId: "render_drums",
  })
  await expect(page.getByTestId("project-rhythm-state")).toContainText(
    "Bass & drums applied to Chorus",
  )
  await expect(page.getByTestId("project-rhythm-state")).toContainText(
    "Recipe and render references saved",
  )

  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  )
  expect(serious).toEqual([])

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)

  await page.screenshot({
    path: "/tmp/paid-bass-drums-final.png",
    fullPage: true,
  })
})
