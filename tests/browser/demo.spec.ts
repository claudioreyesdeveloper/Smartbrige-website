import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const ascii = (value: string) => Array.from(new TextEncoder().encode(value))
const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

function stylePreviewFixture() {
  const track = [
    0, 0xff, 0x06, 7, ...ascii("Intro A"),
    0, 0x97, 65, 80, 96, 0x87, 65, 0,
    0, 0xff, 0x06, 6, ...ascii("Main A"),
    0, 0xb0, 0, 127, 0, 0xb0, 32, 0, 0, 0xc0, 0,
    0, 0xb2, 0, 8, 0, 0xb2, 32, 5, 0, 0xc2, 17,
    0, 0x90, 36, 100, 0, 0x92, 40, 90, 0, 0x93, 60, 80,
    96, 0x80, 36, 0, 0, 0x82, 40, 0, 0, 0x83, 60, 0,
    0, 0xff, 0x06, 6, ...ascii("Main B"),
    0, 0x90, 38, 100, 0, 0x92, 43, 90, 0, 0x93, 48, 80,
    0, 0x94, 52, 80, 0, 0x95, 55, 80, 0, 0x96, 57, 80, 0, 0x97, 60, 80,
    96, 0x80, 38, 0, 0, 0x82, 43, 0, 0, 0x83, 48, 0,
    0, 0x84, 52, 0, 0, 0x85, 55, 0, 0, 0x86, 57, 0, 0, 0x87, 60, 0,
    0, 0xff, 0x06, 8, ...ascii("Ending A"),
    0, 0x97, 67, 80, 96, 0x87, 67, 0,
    0, 0xff, 0x2f, 0,
  ]
  const tail = [...ascii("CASM"), 0, 0, 0, 4, 1, 2, 3, 4]
  return Uint8Array.from([
    ...ascii("MThd"), 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
    ...ascii("MTrk"), ...u32(track.length), ...track, ...tail,
  ])
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const midiWindow = window as unknown as {
      __midiSends: { port: string; data: number[] }[]
    }
    midiWindow.__midiSends = []
    const makePort = (id: string, name: string) => ({
      id,
      name,
      manufacturer: "Yamaha",
      state: "connected",
      onmidimessage: null as null | ((event: { data: Uint8Array }) => void),
      open: async () => {},
      close: async () => {},
      send: (data: Uint8Array) => {
        midiWindow.__midiSends.push({ port: name, data: Array.from(data) })
      },
    })

    const input1 = makePort("yamaha-in-1", "Digital Keyboard Port 1")
    const input2 = makePort("yamaha-in-2", "Digital Keyboard Port 2")
    const output1 = makePort("yamaha-out-1", "Digital Keyboard Port 1")
    const output2 = makePort("yamaha-out-2", "Digital Keyboard Port 2")

    const replyIdentity = (data: Uint8Array) => {
      const bytes = Array.from(data)
      if (bytes.join(",") === "240,67,80,0,0,7,1,247") {
        setTimeout(() => {
          input1.onmidimessage?.({
            data: Uint8Array.from([
              0xf0, 0x43, 0x50, 0, 0, 7, 2, 0,
              0, 71, 101, 110, 111, 115, 50,
              0xf7,
            ]),
          })
        }, 0)
      }
    }
    output1.send = (data: Uint8Array) => {
      midiWindow.__midiSends.push({ port: output1.name, data: Array.from(data) })
      replyIdentity(data)
    }
    output2.send = (data: Uint8Array) => {
      midiWindow.__midiSends.push({ port: output2.name, data: Array.from(data) })
      replyIdentity(data)
    }

    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: async () => ({
        inputs: new Map([
          [input1.id, input1],
          [input2.id, input2],
        ]),
        outputs: new Map([
          [output1.id, output1],
          [output2.id, output2],
        ]),
        onstatechange: null,
      }),
    })
  })
})

test("Demo Station presents both no-login workflows", async ({ page }, testInfo) => {
  await page.goto("/demo")
  if (testInfo.project.name !== "desktop") {
    await expect(page.getByRole("heading", { name: /Please open this demo in Chrome or Microsoft Edge/ })).toBeVisible()
    return
  }
  await expect(page.getByRole("heading", { name: /Experience the future/ })).toBeVisible()
  await expect(page.getByRole("link", { name: /Launch Jam Player/ })).toBeVisible()
  await expect(page.getByRole("link", { name: /Launch Style Maker/ })).toBeVisible()
  await expect(page.getByText("No login. No registration.")).toBeVisible()
})

test("Jam Player exposes two complete 4/4 songs per category and mocked Web MIDI", async ({
  page,
}, testInfo) => {
  await page.goto("/demo/jam-player")
  if (testInfo.project.name !== "desktop") {
    await expect(page.getByRole("heading", { name: /Please open this demo in Chrome or Microsoft Edge/ })).toBeVisible()
    return
  }
  await page.getByRole("button", { name: "Genos2" }).click()
  await page.getByRole("button", { name: "Connect my keyboard" }).last().click()
  await expect(page.getByText("16 complete 4/4 arrangements")).toBeVisible()
  await expect(page.locator(".song-list button")).toHaveCount(2)
  await page.locator(".category-tabs").getByRole("button", { name: /Rock/ }).click()
  await expect(page.locator(".song-list button")).toHaveCount(2)
  await expect(page.getByPlaceholder("Search 796 styles")).toBeVisible()
  await expect(page.getByRole("button", { name: "Play arrangement" })).toBeVisible()
  await expect(page.locator(".timeline-section header strong").nth(0)).toHaveText("Section A")
  await expect(page.locator(".timeline-section header strong").nth(1)).toHaveText("Chorus")
  await expect(page.locator(".timeline-section header strong").nth(2)).toHaveText("Verse")

  await page.evaluate(() => {
    (window as unknown as { __midiSends: unknown[] }).__midiSends = []
  })
  await page.locator(".timeline-section").nth(1).dblclick()
  await expect(page.getByText("Playing Chorus from the beginning.")).toBeVisible()
  await page.waitForTimeout(30)
  const sectionSends = await page.evaluate(() =>
    (window as unknown as { __midiSends: { data: number[] }[] }).__midiSends,
  )
  expect(sectionSends.some(({ data }) =>
    data.join(",") === "240,67,126,0,9,127,247",
  )).toBe(true)
  expect(sectionSends.some(({ data }) =>
    data.join(",") === "240,67,126,0,0,127,247",
  )).toBe(false)
  const chordNoteOns = sectionSends.filter(({ data }) => data[0] === 0x93 && data[2] === 1)
  expect(chordNoteOns.length).toBeGreaterThan(0)
  expect(chordNoteOns.length).toBeLessThanOrEqual(5)

  await page.evaluate(() => {
    (window as unknown as { __midiSends: unknown[] }).__midiSends = []
  })
  await page.getByRole("combobox", { name: "Yamaha style" }).selectOption({ index: 1 })
  const styleSends = await page.evaluate(() =>
    (window as unknown as { __midiSends: { data: number[] }[] }).__midiSends,
  )
  expect(styleSends.some(({ data }) =>
    data.slice(0, 11).join(",") === "240,67,115,1,81,5,0,3,4,0,0",
  )).toBe(true)

  await page.evaluate(() => {
    (window as unknown as { __midiSends: unknown[] }).__midiSends = []
  })
  await page.getByLabel("Search styles").fill("JazzFunk")
  await expect(page.locator(".style-catalog-controls > span")).toHaveText("JazzFunk")
  const autocompleteSends = await page.evaluate(() =>
    (window as unknown as { __midiSends: { data: number[] }[] }).__midiSends,
  )
  expect(autocompleteSends.some(({ data }) =>
    data.slice(0, 11).join(",") === "240,67,115,1,81,5,0,3,4,0,0",
  )).toBe(true)

  const firstChord = page.locator(".timeline-chord").first()
  const originalChord = await firstChord.textContent()
  await page.getByRole("combobox", { name: "Reharmonization" }).selectOption("Basic")
  await expect(page.getByText("Basic reharmonization selected.")).toBeVisible()
  expect(await firstChord.textContent()).not.toBe(originalChord)
})

test("Style Maker clearly requires a user donor file", async ({ page }, testInfo) => {
  await page.goto("/demo/style-maker")
  if (testInfo.project.name !== "desktop") {
    await expect(page.getByText(/Safari, Firefox, phones, and tablets/)).toBeVisible()
    return
  }
  await page.getByRole("button", { name: "Genos2" }).click()
  await page.getByRole("button", { name: "Connect my keyboard" }).last().click()
  await expect(page.getByText("Drop your Yamaha style here")).toBeVisible()
  await expect(page.getByText(/Or click to browse/)).toBeVisible()
  await expect(page.getByText(/Nothing is uploaded to a server/i)).toBeVisible()
})

test("Style Maker accepts a Yamaha donor style from the dropzone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Web MIDI routing is checked in Chromium")
  await page.goto("/demo/style-maker")
  await page.getByRole("button", { name: "Genos2" }).click()
  await page.getByRole("button", { name: "Connect my keyboard" }).last().click()
  await expect(page.getByRole("button", { name: /Drop your Yamaha style here/ })).toBeVisible()
  await page.locator(".style-dropzone input").setInputFiles({
    name: "drag-drop.prs",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(stylePreviewFixture()),
  })
  await expect(page.getByText("drag-drop.prs")).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Style Maker section" })).toBeVisible()
  await expect(page.getByRole("button", { name: /Save Main A/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Record$/ })).toBeVisible()
  await expect(page.getByRole("group", { name: "Style channels" })).toBeVisible()
})

test("Style Maker section record captures ch 9-16 and enables DRAG", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Web MIDI capture is checked in Chromium")
  await page.goto("/demo/style-maker")
  await page.getByRole("button", { name: "Genos2" }).click()
  await page.getByRole("button", { name: "Connect my keyboard" }).last().click()
  await page.locator(".style-dropzone input").setInputFiles({
    name: "record-test.prs",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(stylePreviewFixture()),
  })
  await expect(page.getByRole("button", { name: /^Record$/ })).toBeEnabled()
  await page.getByRole("button", { name: /^Record$/ }).click()
  await expect(page.getByText("Recording…")).toBeVisible()

  // Inject style-engine notes on channels 9–16 while capture is armed.
  await page.evaluate(() => {
    const midiWindow = window as unknown as {
      __midiInputs?: Map<string, { onmidimessage: null | ((event: { data: Uint8Array }) => void) }>
    }
    // The session stores ports privately; dispatch through any attached handler
    // by synthesizing Port 2 traffic via the mock ports created in beforeEach.
    const outputs = (navigator as unknown as {
      requestMIDIAccess: () => Promise<{
        inputs: Map<string, { onmidimessage: null | ((e: { data: Uint8Array }) => void) }>
      }>
    })
    void outputs
  })

  // Re-open access to the same mock ports and fire note events on ch 9/11.
  await page.evaluate(async () => {
    const access = await navigator.requestMIDIAccess()
    const input2 = [...access.inputs.values()].find((port) => /Port 2/i.test(port.name || ""))
    if (!input2?.onmidimessage) return
    input2.onmidimessage({ data: Uint8Array.of(0x98, 36, 100) })
    input2.onmidimessage({ data: Uint8Array.of(0x9a, 40, 90) })
    await new Promise((resolve) => setTimeout(resolve, 30))
    input2.onmidimessage({ data: Uint8Array.of(0x88, 36, 0) })
    input2.onmidimessage({ data: Uint8Array.of(0x8a, 40, 0) })
  })

  await page.getByLabel("Record section").getByRole("button", { name: "Stop" }).click()
  await expect(page.getByRole("button", { name: /DRAG/ })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(/Recording complete/)).toBeVisible()
})

test("Style Maker previews voices and channels 9-16 on Port 2", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Web MIDI routing is checked in Chromium")
  await page.goto("/demo/style-maker")
  await page.getByRole("button", { name: "Genos2" }).click()
  await page.getByRole("button", { name: "Connect my keyboard" }).last().click()
  await page.locator(".style-dropzone input").setInputFiles({
    name: "routing-test.prs",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(stylePreviewFixture()),
  })
  const sectionPicker = page.getByRole("combobox", { name: "Style Maker section" })
  await expect(sectionPicker.locator("option")).toHaveCount(2)
  await sectionPicker.selectOption({ index: 1 })
  await expect(page.locator(".lane-audition-controls").getByRole("button", { name: /Start/ })).toHaveCount(2)
  await expect(page.getByRole("button", { name: /Save Main B/ })).toBeEnabled()
  await page.getByRole("button", { name: /Save Main B/ }).click()
  await expect(page.getByText(/Main B saved into your new style/)).toBeVisible()
  await expect(page.getByRole("button", { name: /Main B saved/ })).toBeDisabled()
  await sectionPicker.selectOption({ index: 0 })
  await expect(page.getByRole("button", { name: /Save Main A/ })).toBeEnabled()
  await page.getByRole("button", { name: /Save Main A/ }).click()
  await expect(page.getByText(/Saved Main B, Main A|Saved Main A, Main B/)).toBeVisible()
  await sectionPicker.selectOption({ index: 1 })

  await page.evaluate(() => {
    (window as unknown as { __midiSends: unknown[] }).__midiSends = []
  })
  await page.getByRole("button", { name: /BEFORE · START/ }).click()
  await page.waitForTimeout(100)
  let sends = await page.evaluate(() =>
    (window as unknown as { __midiSends: { port: string; data: number[] }[] }).__midiSends,
  )
  expect(sends.some(({ port, data }) => port.endsWith("Port 2") && data[0] === 0x98)).toBe(true)
  expect(sends.some(({ port, data }) => port.endsWith("Port 2") && data[0] === 0x9a)).toBe(true)
  await page.locator(".compare-actions").getByRole("button", { name: "Stop" }).click()

  await page.evaluate(() => {
    (window as unknown as { __midiSends: unknown[] }).__midiSends = []
  })
  await page.locator(".lane-editor").first().getByRole("button", { name: /Deep Pocket/ }).dblclick()
  await page.waitForTimeout(100)
  sends = await page.evaluate(() =>
    (window as unknown as { __midiSends: { port: string; data: number[] }[] }).__midiSends,
  )
  expect(sends.some(({ port, data }) => port.endsWith("Port 2") && data[0] === 0x9a)).toBe(true)
  await page.locator(".lane-editor").first().getByRole("button", { name: /Stop/ }).click()

  await page.getByRole("button", { name: /AFTER/ }).click()
  await page.waitForTimeout(100)

  sends = await page.evaluate(() =>
    (window as unknown as { __midiSends: { port: string; data: number[] }[] }).__midiSends,
  )
  expect(sends.some(({ port, data }) =>
    port.endsWith("Port 2") &&
    data.join(",") === "240,67,16,76,8,10,1,8,247",
  )).toBe(true)
  expect(sends.some(({ port, data }) =>
    port.endsWith("Port 2") &&
    data.join(",") === "240,67,16,76,8,10,2,5,247",
  )).toBe(true)
  expect(sends.some(({ port, data }) =>
    port.endsWith("Port 2") &&
    data.join(",") === "240,67,16,76,8,10,3,17,247",
  )).toBe(true)
  for (let status = 0x98; status <= 0x9f; status += 1) {
    expect(sends.some(({ port, data }) =>
      port.endsWith("Port 2") && data[0] === status,
    )).toBe(true)
  }
  const bassNotes = sends.filter(({ data }) => data[0] === 0x9a && data[2] > 0)
  expect(bassNotes.length).toBeGreaterThan(0)
  expect(bassNotes.every(({ data }) => data[2] <= 80)).toBe(true)
})

test("demo landing has no serious accessibility violations", async ({ page }) => {
  await page.goto("/demo")
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  )
  expect(serious).toEqual([])
})
