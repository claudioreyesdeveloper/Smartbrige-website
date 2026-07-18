import { expect, test } from "@playwright/test"
import { applyAccessFixture } from "./helpers/access-fixture"

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop-only paid workspace")
  await applyAccessFixture(page, {
    userId: "fixture-user",
    email: "fixture@example.com",
    entitlements: [
      { serviceKey: "jam-player", status: "active" },
      { serviceKey: "bass-drums", status: "active" },
      { serviceKey: "solo-phrases", status: "active" },
      { serviceKey: "genos-mixer", status: "active" },
    ],
  })
})

test("generate takes, audition, save one, and restore project state", async ({
  page,
}) => {
  await page.goto("/app/jam-player/solo")

  await expect(
    page.getByRole("heading", { name: "Solo Phrases", level: 1 }),
  ).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "SmartBridge services" }),
  ).toBeVisible()
  await expect(page.getByRole("tab", { name: "Solo Ideas" })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await expect(page.getByText("Brass Harmonizer")).toHaveCount(0)
  await expect(page.getByText("Strings Harmonizer")).toHaveCount(0)
  await expect(page.getByText("Decorations", { exact: true })).toHaveCount(0)

  await page.getByLabel("Style").selectOption({ label: "Soul & Motown" })
  await page.getByLabel("Instrument").selectOption({ label: "Trumpet" })
  await page.getByLabel("Feel of the lines").selectOption({ label: "Expressive" })
  await page.getByRole("button", { name: "Generate 4 Takes" }).click()

  const takeList = page.getByRole("listbox", { name: "Generated solo takes" })
  await expect(takeList.getByRole("option")).toHaveCount(4)
  await expect(page.getByText("4 takes ready for Verse 1")).toBeVisible()

  const take = page.getByRole("option", { name: /Take 2/ })
  await take.click()
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await expect(page.getByText("Playing Take 2")).toBeVisible()
  await page.getByRole("button", { name: "Stop", exact: true }).click()
  await expect(page.locator(".solo-status-light")).toHaveClass(/is-stopped/)

  await page.getByRole("button", { name: "Save Selected Take" }).click()
  await expect(page.getByTestId("saved-solo-state")).toContainText("Take 2")
  await expect(page.getByTestId("saved-solo-state")).toContainText("Trumpet")

  await page.getByLabel("Project").selectOption({ label: "Midnight Signals" })
  await expect(page.getByRole("heading", { name: "Midnight Signals", level: 2 })).toBeVisible()
  await page.getByLabel("Project").selectOption({ label: "Coastal Drive" })
  await expect(page.getByTestId("saved-solo-state")).toContainText("Take 2")
  await expect(page.getByText("Selected for Verse 1")).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)

  await page.screenshot({
    path: "/tmp/paid-solo-ui.png",
    fullPage: true,
  })
})
