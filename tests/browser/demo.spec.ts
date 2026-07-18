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
    0, 0xb0, 0, 127, 0, 0xb0, 32, 0, 0, 0xc0, 0,
    0, 0xb2, 0, 0, 0, 0xb2, 32, 0, 0, 0xc2, 33,
    0, 0x90, 36, 100, 0, 0x92, 40, 90, 0, 0x93, 60, 80,
    96, 0x80, 36, 0, 0, 0x82, 40, 0, 0, 0x83, 60, 0,
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
  await expect(page.getByText(/Nothing is uploaded to a server/)).toBeVisible()
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
  await page.getByRole("button", { name: /AFTER/ }).click()
  await page.waitForTimeout(100)

  const sends = await page.evaluate(() =>
    (window as unknown as { __midiSends: { port: string; data: number[] }[] }).__midiSends,
  )
  expect(sends.some(({ port, data }) =>
    port.endsWith("Port 2") &&
    data.slice(0, 7).join(",") === "240,67,16,76,8,10,1",
  )).toBe(true)
  expect(sends.some(({ port, data }) =>
    port.endsWith("Port 2") && (data[0] === 0x98 || data[0] === 0x9a),
  )).toBe(true)
})

test("demo landing has no serious accessibility violations", async ({ page }) => {
  await page.goto("/demo")
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  )
  expect(serious).toEqual([])
})
