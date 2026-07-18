import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { applyAccessFixture } from "./helpers/access-fixture"

test.beforeEach(async ({ page }) => {
  await applyAccessFixture(page)
})

test("paid Jam Player loads songs, timeline, and transport controls", async ({
  page,
}, testInfo) => {
  await page.goto("/app/jam-player")

  await expect(page.getByRole("heading", { name: "Jam Player", level: 1 })).toBeVisible()
  await expect(page.getByText(/Three steps: choose a song/i)).toBeVisible()
  await expect(page.getByRole("button", { name: "Coastal Drive" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Coastal Drive", level: 2 })).toBeVisible()
  await expect(page.getByLabel("Coastal Drive section timeline")).toBeVisible()
  await expect(page.getByLabel("Play Verse")).toBeVisible()
  await expect(page.getByLabel("Play Chorus")).toBeVisible()
  await expect(page.getByRole("button", { name: /Play arrangement/i })).toBeVisible()
  await expect(page.getByLabel("Search styles")).toBeVisible()
  await expect(page.getByLabel("Loop full song")).toBeVisible()
  await expect(page.getByLabel("Reharmonization candidate")).toBeVisible()
  // Style Maker stays out of the Jam workspace (sidebar roadmap entry may still exist).
  await expect(page.locator(".paid-jam")).not.toContainText(/Style Maker/i)

  if (testInfo.project.name === "desktop") {
    await page.getByRole("button", { name: /Play arrangement/i }).click()
    await expect(page.getByText(/Preparing arrangement|Playing full arrangement/i)).toBeVisible({
      timeout: 10_000,
    })
  }
})

test("paid Jam Player save status and style autocomplete are available", async ({ page }) => {
  await page.goto("/app/jam-player")

  await expect(page.getByText(/All changes saved|Unsaved changes|Saved/i).first()).toBeVisible()
  await page.getByLabel("Search styles").fill("CoolJazz")
  await expect(page.getByLabel("Yamaha style")).toContainText(/CoolJazz/)
  await page.getByRole("button", { name: "Get candidates" }).click()
  await expect(page.getByLabel("Reharmonization candidate")).toContainText(/Warm|Bright|Modal/, {
    timeout: 10_000,
  })
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
