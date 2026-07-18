import { expect, test, type Page } from "@playwright/test"

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
    0, 0xff, 0x06, 6, ...ascii("Main C"),
    0, 0x90, 41, 100, 0, 0x92, 45, 90,
    96, 0x80, 41, 0, 0, 0x82, 45, 0,
    0, 0xff, 0x06, 6, ...ascii("Main D"),
    0, 0x90, 43, 100, 0, 0x92, 47, 90,
    96, 0x80, 43, 0, 0, 0x82, 47, 0,
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

async function connectGenos2(page: Page) {
  await page.getByRole("button", { name: "Genos2" }).click()
  await page.getByRole("button", { name: "Connect my keyboard" }).last().click()
  await expect(page.getByText(/Genos|connected|Disconnect/i).first()).toBeVisible({ timeout: 8000 })
}

async function uploadDonor(page: Page, name = "controls.prs") {
  await page.locator(".style-dropzone input").setInputFiles({
    name,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(stylePreviewFixture()),
  })
  await expect(page.getByText(name)).toBeVisible()
}

async function injectStyleEngineNotes(page: Page) {
  await page.evaluate(async () => {
    const access = await navigator.requestMIDIAccess()
    const input2 = [...access.inputs.values()].find((port) => /Port 2/i.test(port.name || ""))
    if (!input2?.onmidimessage) return
    for (let ch = 0; ch < 8; ch += 1) {
      input2.onmidimessage({ data: Uint8Array.of(0x98 | ch, 36 + ch, 100) })
    }
    await new Promise((resolve) => setTimeout(resolve, 40))
    for (let ch = 0; ch < 8; ch += 1) {
      input2.onmidimessage({ data: Uint8Array.of(0x88 | ch, 36 + ch, 0) })
    }
  })
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

test.describe("Demo Station controls", () => {
  test("landing links and chrome", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop Chrome control coverage")
    await page.goto("/demo")
    await expect(page.getByRole("heading", { name: /Experience the future/ })).toBeVisible()
    await expect(page.getByRole("link", { name: /Launch Jam Player/ })).toBeVisible()
    await expect(page.getByRole("link", { name: /Launch Style Maker/ })).toBeVisible()
    await page.getByRole("link", { name: /Launch Style Maker/ }).click()
    await expect(page).toHaveURL(/\/demo\/style-maker/)
    await page.getByRole("link", { name: /Back to Demo Station/ }).click()
    await expect(page).toHaveURL(/\/demo$/)
    await page.getByRole("link", { name: /Launch Jam Player/ }).click()
    await expect(page).toHaveURL(/\/demo\/jam-player/)
  })
})

test.describe("Style Maker exhaustive controls", () => {
  test("keyboard picker, donor upload, and every Main section", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop Chrome control coverage")
    await page.goto("/demo/style-maker")

    for (const model of ["Genos", "Genos2", "Tyros4", "Tyros5"]) {
      await page.getByRole("button", { name: model, exact: true }).click()
      await expect(page.getByRole("button", { name: model, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      )
    }
    await connectGenos2(page)
    await expect(page.getByRole("button", { name: /Drop your Yamaha style here/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /Disconnect/ })).toBeVisible()

    await uploadDonor(page)
    const sectionPicker = page.getByRole("combobox", { name: "Style Maker section" })
    await expect(sectionPicker.locator("option")).toHaveCount(4)

    for (let index = 0; index < 4; index += 1) {
      await sectionPicker.selectOption({ index })
      await expect(page.getByRole("button", { name: /Save Main [A-D]/ })).toBeVisible()
    }
  })

  test("bass and drum catalog, audition, and custom MIDI upload", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop Chrome control coverage")
    await page.goto("/demo/style-maker")
    await connectGenos2(page)
    await uploadDonor(page)

    const bassEditor = page.locator(".lane-editor").nth(0)
    const drumEditor = page.locator(".lane-editor").nth(1)
    await expect(bassEditor.locator(".part-carousel button")).toHaveCount(10)
    await expect(drumEditor.locator(".part-carousel button")).toHaveCount(10)

    await bassEditor.locator(".part-carousel button").nth(2).click()
    await expect(bassEditor.locator(".part-carousel button").nth(2)).toHaveClass(/is-active/)
    await drumEditor.locator(".part-carousel button").nth(3).click()
    await expect(drumEditor.locator(".part-carousel button").nth(3)).toHaveClass(/is-active/)

    await bassEditor.getByRole("button", { name: /Start/ }).click()
    await expect(bassEditor.getByRole("button", { name: /Stop/ })).toBeEnabled()
    await bassEditor.getByRole("button", { name: /Stop/ }).click()

    await drumEditor.getByRole("button", { name: /Start/ }).click()
    await expect(drumEditor.getByRole("button", { name: /Stop/ })).toBeEnabled()
    await drumEditor.getByRole("button", { name: /Stop/ }).click()

    await bassEditor.locator(".part-carousel button").nth(1).dblclick()
    await page.waitForTimeout(50)
    await bassEditor.getByRole("button", { name: /Stop/ }).click()

    const laneMidi = Buffer.from([
      ...ascii("MThd"), 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
      ...ascii("MTrk"), ...u32(8),
      0, 0x90, 40, 100, 96, 0x80, 40, 0, 0, 0xff, 0x2f, 0,
    ])
    await bassEditor.locator(".midi-upload input").setInputFiles({
      name: "custom-bass.mid",
      mimeType: "audio/midi",
      buffer: laneMidi,
    })
    await expect(bassEditor.getByRole("button", { name: /Your MIDI custom-bass\.mid/ })).toBeVisible()
    await drumEditor.locator(".midi-upload input").setInputFiles({
      name: "custom-drums.mid",
      mimeType: "audio/midi",
      buffer: laneMidi,
    })
    await expect(drumEditor.getByRole("button", { name: /Your MIDI custom-drums\.mid/ })).toBeVisible()
  })

  test("before/after compare, save all Mains, download and load", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop Chrome control coverage")
    await page.goto("/demo/style-maker")
    await connectGenos2(page)
    await uploadDonor(page)

    const sectionPicker = page.getByRole("combobox", { name: "Style Maker section" })
    await expect(page.getByRole("button", { name: /Download style/ })).toBeDisabled()
    await expect(page.getByRole("button", { name: /Load to Keyboard/ })).toBeDisabled()

    for (let index = 0; index < 4; index += 1) {
      await sectionPicker.selectOption({ index })
      await page.locator(".lane-editor").nth(0).locator(".part-carousel button").nth(index % 10).click()
      await page.locator(".lane-editor").nth(1).locator(".part-carousel button").nth((index + 2) % 10).click()
      await page.getByRole("button", { name: /Save Main [A-D]/ }).click()
      await expect(page.getByRole("button", { name: /Main [A-D] saved/ })).toBeDisabled()
    }

    await expect(page.getByText(/Saved Main/)).toBeVisible()
    await expect(page.getByRole("button", { name: /Download style/ })).toBeEnabled()
    await expect(page.getByRole("button", { name: /Load to Keyboard/ })).toBeEnabled()

    await page.getByRole("button", { name: /BEFORE · START/ }).click()
    await page.waitForTimeout(80)
    await page.locator(".compare-actions").getByRole("button", { name: "Stop" }).click()
    await page.getByRole("button", { name: /AFTER/ }).click()
    await page.waitForTimeout(80)
    await page.locator(".compare-actions").getByRole("button", { name: "Stop" }).click()

    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: /Download style/ }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^SmartBridge_controls\.prs$/)

    await page.getByRole("button", { name: /Load to Keyboard/ }).click()
    await expect(page.getByRole("dialog", { name: /Loading style|Your new band/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test("section record channel toggles, Record/Stop/DRAG, record again", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop Chrome control coverage")
    await page.goto("/demo/style-maker")
    await connectGenos2(page)
    await uploadDonor(page)

    const recordPanel = page.getByLabel("Record section")
    await expect(recordPanel.getByRole("checkbox")).toHaveCount(8)
    const names = [
      "Rhythm 1", "Rhythm 2", "Bass", "Chord 1", "Chord 2", "Pad", "Phrase 1", "Phrase 2",
    ]
    for (const name of names) {
      await expect(recordPanel.getByLabel(name, { exact: true })).toBeChecked()
    }

    await recordPanel.getByLabel("Phrase 2", { exact: true }).uncheck()
    await expect(recordPanel.getByLabel("Phrase 2", { exact: true })).not.toBeChecked()

    await recordPanel.getByRole("button", { name: /^Record$/ }).click()
    await expect(page.getByText("Recording…")).toBeVisible()
    await injectStyleEngineNotes(page)
    await recordPanel.getByRole("button", { name: "Stop" }).click()
    await expect(recordPanel.getByRole("button", { name: /DRAG/ })).toBeVisible()
    await expect(page.getByText(/Recording complete/)).toBeVisible()

    const dragDownload = page.waitForEvent("download")
    await recordPanel.getByRole("button", { name: /DRAG/ }).click()
    const recorded = await dragDownload
    expect(recorded.suggestedFilename()).toMatch(/\.mid$/i)

    await recordPanel.getByRole("button", { name: /Record again/ }).click()
    await expect(page.getByText("Recording…")).toBeVisible()
    await injectStyleEngineNotes(page)
    await recordPanel.getByRole("button", { name: "Stop" }).click()
    await expect(recordPanel.getByRole("button", { name: /DRAG/ })).toBeVisible()
  })

  test("disconnect returns to keyboard setup", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop Chrome control coverage")
    await page.goto("/demo/style-maker")
    await connectGenos2(page)
    await uploadDonor(page)
    await page.getByRole("button", { name: /Disconnect/ }).click()
    await expect(page.getByRole("heading", { name: /Which Yamaha keyboard/ })).toBeVisible()
  })
})

test.describe("Jam Player exhaustive controls", () => {
  test("categories, songs, style search, reharm, section play", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop Chrome control coverage")
    await page.goto("/demo/jam-player")
    await connectGenos2(page)

    await expect(page.getByRole("button", { name: "Play arrangement" })).toBeVisible()
    const categories = page.locator(".category-tabs button")
    const categoryCount = await categories.count()
    expect(categoryCount).toBeGreaterThan(1)
    for (let index = 0; index < Math.min(categoryCount, 4); index += 1) {
      await categories.nth(index).click()
      await expect(page.locator(".song-list button").first()).toBeVisible()
    }

    await page.locator(".song-list button").nth(1).click()
    await page.getByRole("button", { name: "Play arrangement" }).click()
    await page.waitForTimeout(100)
    await page.getByRole("button", { name: /Stop|Pause/i }).first().click().catch(() => {})

    await page.locator(".timeline-section").nth(1).dblclick()
    await expect(page.getByText(/Playing .+ from the beginning/)).toBeVisible()

    const styleSelect = page.getByRole("combobox", { name: "Yamaha style" })
    if (await styleSelect.count()) {
      await styleSelect.selectOption({ index: 1 })
    }
    await page.getByLabel("Search styles").fill("Jazz")
    await expect(page.getByLabel("Search styles")).toHaveValue("Jazz")

    const reharm = page.getByRole("combobox", { name: "Reharmonization" })
    if (await reharm.count()) {
      await reharm.selectOption("Basic")
      await expect(page.getByText(/reharmonization selected/i)).toBeVisible()
    }
  })
})
