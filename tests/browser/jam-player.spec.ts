import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { applyAccessFixture } from "./helpers/access-fixture"

test.beforeEach(async ({ page }) => {
  await applyAccessFixture(page)
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
    const input2 = {
      ...input1,
      id: "in2",
      name: "Yamaha Genos Port 2",
    }
    const makeOutput = (id: string, name: string) => ({
      id,
      name,
      manufacturer: "Yamaha",
      state: "connected",
      open: async () => undefined,
      close: async () => undefined,
      send: (data: Uint8Array | number[]) => {
        const win = window as typeof window & {
          __jamMidiSendCount?: number
        }
        win.__jamMidiSendCount = (win.__jamMidiSendCount ?? 0) + 1
        const bytes = Array.from(data)
        if (bytes[0] === 0xf0 && bytes[1] === 0x7e) {
          setTimeout(() => {
            input1.onmidimessage?.({
              data: Uint8Array.from([
                0xf0, 0x7e, 0x7f, 0x06, 0x02, 0x43, 0x7f, 0x68, 0x00, 0x00, 0xf7,
              ]),
            })
          }, 0)
        }
      },
    })
    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: async (options: { sysex: boolean }) => {
        const win = window as typeof window & {
          __jamMidiAccess?: { count: number; sysex: boolean }
        }
        win.__jamMidiAccess = {
          count: (win.__jamMidiAccess?.count ?? 0) + 1,
          sysex: options.sysex,
        }
        return {
          inputs: new Map([
            [input1.id, input1],
            [input2.id, input2],
          ]),
          outputs: new Map([
            ["out1", makeOutput("out1", "Yamaha Genos Port 1")],
            ["out2", makeOutput("out2", "Yamaha Genos Port 2")],
          ]),
          onstatechange: null,
        }
      },
    })
  })

  const now = "2026-07-18T12:00:00.000Z"
  await page.route("**/api/catalog/jam-player", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        serviceKey: "jam-player",
        catalogVersionId: "browser-fixture",
        contentTreeSha256: "a".repeat(64),
        catalogExportVersion: 1,
        schemaVersion: 1,
        entries: [
          {
            stableId: "factory_song:coastal",
            section: "factory_songs",
            kind: "factory_song",
            hasAsset: false,
            blobReferenceId: null,
            metadata: {
              stable_id: "factory_song:coastal",
              song: {
                id: "internal-song",
                name: "Coastal Drive",
                category: "Pop",
                bpm: 112,
                key: "C",
                description: "Bright Pop factory arrangement",
                ts_num: 4,
                ts_den: 4,
              },
              source: {
                library: "Pop",
                path: null,
                source_file: null,
                license: null,
                license_status: "UNKNOWN",
              },
              clip_count: 2,
              chord_block_count: 2,
            },
          },
          ...[
            ["factory_clip:verse", "Verse", "A", 0],
            ["factory_clip:chorus", "Chorus", "B", 1],
          ].map(([stableId, name, main, order]) => ({
            stableId,
            section: "factory_songs",
            kind: "factory_clip",
            hasAsset: false,
            blobReferenceId: null,
            metadata: {
              stable_id: stableId,
              song_stable_id: "factory_song:coastal",
              variation_count: 0,
              clip: {
                id: Number(order) + 1,
                song_id: "internal-song",
                name,
                bars: 4,
                clip_order: order,
                style_variation: main,
                notes: null,
                created_at: 0,
                updated_at: 0,
              },
              asset: null,
            },
          })),
          ...[
            ["factory_chord:verse", "Verse", "C"],
            ["factory_chord:chorus", "Chorus", "F"],
          ].map(([stableId, sectionLabel, chord]) => ({
            stableId,
            section: "factory_songs",
            kind: "factory_chord_block",
            hasAsset: false,
            blobReferenceId: null,
            metadata: {
              stable_id: stableId,
              song_stable_id: "factory_song:coastal",
              block: {
                id: stableId,
                song_id: "internal-song",
                section_label: sectionLabel,
                chord_name: chord,
                start_bar: 0,
                start_beat: 0,
                length_beats: 4,
                root: 0,
                quality: "major",
                confidence: 1,
                is_user_override: 0,
                analysis_version: 1,
                clip_id: -1,
                created_at: 0,
                updated_at: 0,
              },
            },
          })),
          {
            stableId: "keyboard_model:genos",
            section: "keyboard_catalog",
            kind: "keyboard_model",
            hasAsset: false,
            blobReferenceId: null,
            metadata: {
              stable_id: "keyboard_model:genos",
              model: { id: 1, model_key: "genos", display_name: "Genos" },
              source: {
                library: null,
                path: null,
                source_file: null,
                license: null,
                license_status: "UNKNOWN",
              },
              styles: [
                { id: 1, name: "EasyPop", style_number: 12, category: "Pop", bpm: 112 },
                { id: 2, name: "CoolJazz", style_number: 71, category: "Jazz", bpm: 110 },
              ],
              voices: [],
              multipads: [],
            },
          },
          {
            stableId: "keyboard_model:genos2",
            section: "keyboard_catalog",
            kind: "keyboard_model",
            hasAsset: false,
            blobReferenceId: null,
            metadata: {
              stable_id: "keyboard_model:genos2",
              model: { id: 2, model_key: "genos2", display_name: "Genos2" },
              source: {
                library: null,
                path: null,
                source_file: null,
                license: null,
                license_status: "UNKNOWN",
              },
              styles: [
                { id: 1, name: "EasyPop", style_number: 12, category: "Pop", bpm: 112 },
                { id: 2, name: "CoolJazz", style_number: 71, category: "Jazz", bpm: 110 },
              ],
              voices: [],
              multipads: [],
            },
          },
        ],
      }),
    })
  })
  await page.route("**/api/projects", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"projects":[]}' })
      return
    }
    const request = route.request().postDataJSON() as {
      title: string
      document: unknown
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        project: {
          id: "proj_browser_1",
          title: request.title,
          revisionId: "rev_browser_1",
          version: 1,
          document: request.document,
          createdAt: now,
          updatedAt: now,
        },
      }),
    })
  })
  await page.route("**/api/projects/proj_browser_1", async (route) => {
    const request = route.request().postDataJSON() as {
      title: string
      document: unknown
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        project: {
          id: "proj_browser_1",
          title: request.title,
          revisionId: "rev_browser_2",
          version: 2,
          document: request.document,
          createdAt: now,
          updatedAt: now,
        },
      }),
    })
  })
  await page.route("**/api/engine/jam/prepare", async (route) => {
    // Intro bar shifts fullSong past content-only length; durationMs must cover it
    // (regression for "fullSong[n].atMs exceeds display.durationMs").
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        planId: "plan_browser_1",
        expiresAt: "2099-01-01T00:00:00.000Z",
        display: {
          tempoBpm: 112,
          key: "C",
          timeSignature: { numerator: 4, denominator: 4 },
          durationMs: 3000,
          sections: [
            { id: "factory_clip:verse", name: "Verse", startBar: 0, barCount: 4 },
            { id: "factory_clip:chorus", name: "Chorus", startBar: 4, barCount: 4 },
          ],
          chords: [
            { symbol: "C", startBar: 0, durationBars: 1 },
            { symbol: "F", startBar: 4, durationBars: 1 },
          ],
        },
        dispatch: {
          fullSong: [
            { atMs: 0, target: "port1", bytes: "+g==" },
            { atMs: 2140, target: "port1", bytes: "+g==" },
          ],
          sections: {
            "factory_clip:verse": [{ atMs: 0, target: "port1", bytes: "+g==" }],
            "factory_clip:chorus": [{ atMs: 0, target: "port1", bytes: "+g==" }],
          },
        },
      }),
    })
  })
  await page.route("**/api/engine/jam/reharmonize", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generationId: "gen_browser_1",
        candidates: [
          {
            id: "candidate_browser_1",
            label: "Warm",
            chords: [{ symbol: "C6", startBar: 0, durationBars: 1 }],
          },
        ],
      }),
    })
  })
})

test("paid Jam Player loads songs, timeline, and transport controls", async ({
  page,
}, testInfo) => {
  await page.goto("/app/jam-player")

  await expect(page.getByRole("heading", { name: "Jam Player", level: 1 })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "SmartBridge services" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Jam Player", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  )
  await expect(page.locator(".app-shell-sidebar")).toHaveCount(0)
  await expect(page.getByText(/Choose a song, connect your Yamaha/i)).toBeVisible()
  await expect(page.getByText("1 · Keyboard connection")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Choose the musical feel" })).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Play the full song or one section" }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Coastal Drive" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Coastal Drive", level: 2 })).toBeVisible()
  await expect(page.getByLabel("Coastal Drive section timeline")).toBeVisible()
  await expect(page.getByLabel("Play Verse")).toBeVisible()
  await expect(page.getByLabel("Play Chorus")).toBeVisible()
  await expect(page.getByRole("button", { name: /Play arrangement/i })).toBeVisible()
  await expect(page.getByLabel("Search styles")).toBeVisible()
  await expect(page.getByLabel("Loop full song")).toBeVisible()
  await expect(page.getByLabel("Reharmonization candidate")).toBeVisible()
  // Style Maker stays out of the Jam workspace (the shell may still identify it as future).
  await expect(page.locator(".paid-jam")).not.toContainText(/Style Maker/i)

  const hierarchy = await page.evaluate(() => {
    const top = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect().top ?? Number.MAX_SAFE_INTEGER
    return {
      connection: top(".paid-jam-connection"),
      transform: top(".paid-jam-transform-panel"),
      performance: top(".paid-jam-performance-panel"),
      timeline: top(".paid-jam-timeline"),
      optionalHarmony: top(".paid-jam-reharm"),
      navigationBottom:
        document.querySelector(".app-shell-header")?.getBoundingClientRect().bottom ??
        Number.MAX_SAFE_INTEGER,
      workspaceTop:
        document.querySelector(".paid-jam")?.getBoundingClientRect().top ??
        Number.MAX_SAFE_INTEGER,
      mainWidth:
        document.querySelector(".app-shell-main")?.getBoundingClientRect().width ?? 0,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  })
  expect(hierarchy.connection).toBeLessThan(hierarchy.transform)
  expect(hierarchy.transform).toBeLessThan(hierarchy.performance)
  expect(hierarchy.performance).toBeLessThan(hierarchy.timeline)
  expect(hierarchy.timeline).toBeLessThan(hierarchy.optionalHarmony)
  expect(hierarchy.navigationBottom).toBeLessThanOrEqual(hierarchy.workspaceTop)
  expect(hierarchy.mainWidth).toBeGreaterThan(1100)
  expect(hierarchy.overflow).toBeLessThanOrEqual(1)

  if (testInfo.project.name === "desktop" || testInfo.project.name === "tablet") {
    await testInfo.attach("paid-jam-layout", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    })
  }

  if (testInfo.project.name === "desktop") {
    await page.getByRole("group", { name: /Keyboard model/i }).getByRole("button", { name: /^Genos2$/i }).click()
    await page.getByRole("button", { name: /Connect my keyboard/i }).click()
    await expect(page.getByText(/shared for all features/i).first()).toBeVisible()
    await expect(page.getByText(/Connected from app Settings|connected and ready/i).first()).toBeVisible()
    const requests: Array<{ path: string; method: string; body: unknown }> = []
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname
      if (path.startsWith("/api/projects") || path.startsWith("/api/engine/jam/")) {
        requests.push({
          path,
          method: request.method(),
          body: request.postData() ? (request.postDataJSON() as unknown) : null,
        })
      }
    })
    await page.getByRole("button", { name: /Play arrangement/i }).click()
    await expect(page.getByText(/Playing full arrangement/i)).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText(/exceeds display\.durationMs/i)).toHaveCount(0)
    const saveIndex = requests.findIndex(
      (request) => request.path === "/api/projects/proj_browser_1" && request.method === "PUT",
    )
    const prepareIndex = requests.findIndex(
      (request) => request.path === "/api/engine/jam/prepare",
    )
    expect(saveIndex).toBeGreaterThan(-1)
    expect(prepareIndex).toBeGreaterThan(saveIndex)
    expect(requests[saveIndex]!.body).toMatchObject({
      document: {
        song: { sections: [{ name: "Verse" }, { name: "Chorus" }] },
        jam: {
          factorySongStableId: "factory_song:coastal",
          styleStableId: expect.any(String),
          model: "genos2",
        },
      },
    })
    expect(
      await page.evaluate(() => ({
        access: (window as typeof window & { __jamMidiAccess?: unknown }).__jamMidiAccess,
        sends: (window as typeof window & { __jamMidiSendCount?: number }).__jamMidiSendCount,
      })),
    ).toMatchObject({ access: { count: 1, sysex: true }, sends: expect.any(Number) })

    await page.getByRole("button", { name: /^Stop$/ }).click()
    await page.getByLabel("Play Verse").focus()
    await page.keyboard.press("Enter")
    await expect(page.getByText("Playing Verse.")).toBeVisible()
  }
})

test("paid Jam Player save status and style autocomplete are available", async ({ page }) => {
  await page.goto("/app/jam-player")

  await expect(page.getByText(/All changes saved|Unsaved changes|Saved/i).first()).toBeVisible()
  await page.getByLabel("Search styles").fill("CoolJazz")
  await expect(page.getByLabel("Yamaha style")).toContainText(/CoolJazz/)
  await page.getByRole("group", { name: /Keyboard model/i }).getByRole("button", { name: /^Genos2$/i }).click()
  await page.getByRole("button", { name: /Connect my keyboard/i }).click()
  await expect(page.getByText(/Connected from app Settings|connected and ready/i).first()).toBeVisible()
  const paths: string[] = []
  page.on("request", (request) => {
    if (request.url().includes("/api/engine/jam/")) paths.push(new URL(request.url()).pathname)
  })
  await page.getByRole("button", { name: "Suggest chord choices" }).click()
  await expect(page.getByLabel("Reharmonization candidate")).toContainText(/Warm/, {
    timeout: 10_000,
  })
  expect(paths).toContain("/api/engine/jam/reharmonize")
})

test("paid Jam Player has no serious accessibility violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Axe audit on desktop viewport")
  await page.goto("/app/jam-player")
  await expect(page.getByRole("heading", { name: "Coastal Drive", level: 2 })).toBeVisible()

  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  )
  expect(serious).toEqual([])
})
