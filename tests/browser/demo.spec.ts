import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const input = {
      id: "yamaha-in",
      name: "Genos2 Port 2",
      manufacturer: "Yamaha",
      state: "connected",
      onmidimessage: null as null | ((event: { data: Uint8Array }) => void),
      open: async () => {},
      close: async () => {},
    }
    const output = {
      id: "yamaha-out",
      name: "Genos2 Port 2",
      manufacturer: "Yamaha",
      state: "connected",
      open: async () => {},
      close: async () => {},
      send: (data: Uint8Array) => {
        const bytes = Array.from(data)
        if (bytes.join(",") === "240,67,80,0,0,7,1,247") {
          setTimeout(() => {
            input.onmidimessage?.({
              data: Uint8Array.from([
                0xf0, 0x43, 0x50, 0, 0, 7, 2, 0,
                0, 71, 101, 110, 111, 115, 50,
                0xf7,
              ]),
            })
          }, 0)
        }
      },
    }
    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: async () => ({
        inputs: new Map([[input.id, input]]),
        outputs: new Map([[output.id, output]]),
        onstatechange: null,
      }),
    })
  })
})

test("Demo Station presents both no-login workflows", async ({ page }) => {
  await page.goto("/demo")
  await expect(page.getByRole("heading", { name: /Experience the future/ })).toBeVisible()
  await expect(page.getByRole("link", { name: /Launch Jam Player/ })).toBeVisible()
  await expect(page.getByRole("link", { name: /Launch Style Maker/ })).toBeVisible()
  await expect(page.getByText("No login. No registration.")).toBeVisible()
})

test("Jam Player exposes two complete 4/4 songs per category and mocked Web MIDI", async ({
  page,
}) => {
  await page.goto("/demo/jam-player")
  await expect(page.getByText("16 complete 4/4 arrangements")).toBeVisible()
  await expect(page.locator(".song-list button")).toHaveCount(2)
  await page.getByRole("button", { name: /Rock/ }).click()
  await expect(page.locator(".song-list button")).toHaveCount(2)
  await page.getByRole("button", { name: "Connect keyboard" }).click()
  await expect(page.getByText("Genos2", { exact: true })).toHaveText("Genos2")
})

test("Style Maker clearly requires a user donor file", async ({ page }) => {
  await page.goto("/demo/style-maker")
  await expect(page.getByText("Drop your Yamaha style here")).toBeVisible()
  await expect(page.getByText(/Nothing is uploaded to a server/)).toBeVisible()
})

test("demo landing has no serious accessibility violations", async ({ page }) => {
  await page.goto("/demo")
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  )
  expect(serious).toEqual([])
})
