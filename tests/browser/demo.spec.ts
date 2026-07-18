import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const makePort = (id: string, name: string) => ({
      id,
      name,
      manufacturer: "Yamaha",
      state: "connected",
      onmidimessage: null as null | ((event: { data: Uint8Array }) => void),
      open: async () => {},
      close: async () => {},
      send: (_data: Uint8Array) => {},
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
    output1.send = replyIdentity
    output2.send = replyIdentity

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
  await expect(page.getByRole("heading", { name: "Choose a song" })).toBeVisible()
  await expect(page.locator(".senior-song-grid button")).toHaveCount(2)
  await page.getByRole("button", { name: /Rock/ }).click()
  await expect(page.locator(".senior-song-grid button")).toHaveCount(2)
  await page.getByRole("button", { name: /Continue with/ }).click()
  await expect(page.getByRole("button", { name: "Play song" })).toBeVisible()
})

test("Style Maker clearly requires a user donor file", async ({ page }, testInfo) => {
  await page.goto("/demo/style-maker")
  if (testInfo.project.name !== "desktop") {
    await expect(page.getByText(/Safari, Firefox, phones, and tablets/)).toBeVisible()
    return
  }
  await page.getByRole("button", { name: "Genos2" }).click()
  await page.getByRole("button", { name: "Connect my keyboard" }).last().click()
  await expect(page.getByRole("heading", { name: "Choose your Yamaha style file" })).toBeVisible()
  await expect(page.getByText(/never uploaded to the internet/)).toBeVisible()
})

test("demo landing has no serious accessibility violations", async ({ page }) => {
  await page.goto("/demo")
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  )
  expect(serious).toEqual([])
})
