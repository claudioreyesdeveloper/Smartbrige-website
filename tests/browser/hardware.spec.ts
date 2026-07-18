import { expect, test } from "@playwright/test"

test("detects a supported Yamaha keyboard over physical Web MIDI", async ({
  browserName,
  context,
  page,
}, testInfo) => {
  test.skip(process.env.SMARTBRIDGE_HARDWARE_TEST !== "1", "Physical keyboard test is opt-in")
  test.skip(testInfo.project.name !== "desktop", "Physical Web MIDI is tested in Chromium")
  test.skip(browserName !== "chromium", "Web MIDI requires Chromium")

  await context.grantPermissions(["midi", "midi-sysex"], {
    origin: "http://127.0.0.1:3000",
  })
  await page.goto("/demo/jam-player")
  const model = process.env.SMARTBRIDGE_HARDWARE_MODEL || "Genos2"
  await page.getByRole("button", { name: model, exact: true }).click()
  await page.getByRole("button", { name: "Connect my keyboard" }).last().click()
  await expect(page.locator(".keyboard-badge.is-connected")).toContainText(model, { timeout: 10000 })
  await expect(page.getByRole("heading", { name: "Choose a song" })).toBeVisible()
})
