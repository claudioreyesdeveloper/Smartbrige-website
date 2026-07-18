import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { applyAccessFixture } from "./helpers/access-fixture"

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop-only paid workspace")
  await applyAccessFixture(page, {
    userId: "fixture-user",
    email: "fixture@example.com",
    entitlements: [
      { serviceKey: "jam-player", status: "active" },
      { serviceKey: "genos-mixer", status: "active" },
      { serviceKey: "bass-drums", status: "active" },
    ],
  })
})

test("section to bass, audition, suggested drums, fill, and Apply to Song", async ({
  page,
}) => {
  await page.goto("/app/bass-drums")

  await expect(page.getByRole("heading", { name: "Bass & Drums", level: 1 })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "SmartBridge services" })).toBeVisible()
  await expect(page.locator(".app-shell-sidebar")).toHaveCount(0)
  await expect(page.getByRole("tab", { name: "Bass Performance" })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await expect(page.getByRole("tab", { name: "Drum Performance" })).toBeVisible()
  await expect(page.getByText("Rhythm Guitar")).toHaveCount(0)
  await expect(page.getByText("Brass Performance")).toHaveCount(0)

  await page.getByLabel("Song section").selectOption({ label: "Chorus" })
  await expect(page.getByText("Updated for Chorus chord context")).toBeVisible()

  await page.getByLabel("Genre").selectOption("Pop")
  await page.getByLabel("Section", { exact: true }).selectOption("Chorus")
  await page.getByLabel("Feel").selectOption("Straight 8ths")
  await expect(page.getByText("1 result")).toBeVisible()

  const bass = page.getByRole("option", { name: /Melodic Lift 02/ })
  await bass.dblclick()
  await expect(page.getByText("Playing Melodic Lift 02")).toBeVisible()
  await page.getByRole("button", { name: "Stop", exact: true }).click()
  await expect(page.locator(".rhythm-status-light")).toHaveClass(/is-stopped/)

  await page.getByRole("tab", { name: "Drum Performance" }).click()
  const suggested = page.getByRole("button", { name: "Suggested drums" })
  await expect(suggested).toBeEnabled()
  await suggested.click()
  await expect(page.getByText("Suggested drums for Chorus")).toBeVisible()

  await page.getByRole("option", { name: /Open Chorus 02/ }).click()
  const fill = page.getByRole("option", { name: /Compact Turn/ })
  await expect(fill).toBeVisible()
  await fill.click()
  await page.getByRole("button", { name: "Assign selected fill to bar 4" }).click()
  await expect(
    page.getByRole("button", { name: "Assign selected fill to bar 4" }),
  ).toContainText("Compact Turn")

  await page.getByRole("button", { name: "Apply to Song" }).click()
  await expect(page.getByTestId("project-rhythm-state")).toContainText(
    "Bass & drums applied to Chorus",
  )
  await expect(page.getByTestId("project-rhythm-state")).toContainText(
    "Recipe and render references saved",
  )

  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  )
  expect(serious).toEqual([])

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)

  await page.screenshot({
    path: "/tmp/paid-bass-drums-ui.png",
    fullPage: true,
  })
})
