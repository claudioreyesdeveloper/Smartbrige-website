import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { applyAccessFixture } from "./helpers/access-fixture"

test.beforeEach(async ({ page }) => {
  await applyAccessFixture(page)
})

test("App overview lists purchased, upgrade, and coming-soon services", async ({ page }) => {
  await page.goto("/app")

  await expect(page.getByRole("heading", { name: "Service overview" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Your services" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Upgrade to unlock" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "On the roadmap" })).toBeVisible()

  await expect(page.getByRole("link", { name: /Open workspace/i })).toHaveCount(2)
  await expect(page.getByRole("link", { name: /Upgrade to unlock/i })).toHaveCount(3)
  await expect(page.getByRole("button", { name: "Not available yet" })).toHaveCount(1)
  await expect(page.getByRole("heading", { name: "Style Maker" })).toBeVisible()
})

test("Purchased service opens placeholder workspace", async ({ page }) => {
  await page.goto("/app/jam-player")

  await expect(page.getByRole("heading", { name: "Jam Player", level: 1 })).toBeVisible()
  await expect(page.getByText(/This module shell is ready/)).toBeVisible()
  await expect(page.getByRole("link", { name: /Open the public demo/i })).toHaveAttribute(
    "href",
    "/demo",
  )
})

test("Unpurchased service route shows upgrade panel", async ({ page }) => {
  await page.goto("/app/bass-drums")

  await expect(page.locator(".app-shell-upgrade-panel")).toContainText(
    "Bass & Drums is not in your plan",
  )
  await expect(page.getByRole("button", { name: /Subscribe to Bass & Drums/i })).toBeVisible()
  await expect(page.getByRole("link", { name: "Back to overview" })).toHaveAttribute("href", "/app")
})

test("Style Maker nav entry is disabled without a workspace route", async ({ page }) => {
  await page.goto("/app")

  const styleMaker = page.getByTitle("Style Maker is coming soon")
  await expect(styleMaker).toBeVisible()
  await expect(styleMaker).toHaveAttribute("aria-disabled", "true")

  const response = await page.goto("/app/style-maker")
  expect(response?.status()).toBe(404)
})

test("App shell sidebar links to public demo without changing demo routes", async ({
  page,
}, testInfo) => {
  await page.goto("/app")
  await page.getByRole("link", { name: "Public demo" }).click()
  await expect(page).toHaveURL("/demo")
  if (testInfo.project.name !== "desktop") {
    await expect(
      page.getByRole("heading", {
        name: /Please open this demo in Chrome or Microsoft Edge/,
      }),
    ).toBeVisible()
    return
  }
  await expect(page.getByText("No login. No registration.")).toBeVisible()
})

test("App overview has no serious accessibility violations", async ({ page }) => {
  await page.goto("/app")
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  )
  expect(serious).toEqual([])
})
