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
      { serviceKey: "lyrics", status: "active" },
      { serviceKey: "genos-mixer", status: "active" },
    ],
  })
})

test("project melody to edited lyrics, re-fit, audition, export, save, and reopen", async ({
  page,
}) => {
  await page.goto("/app/lyrics")

  await expect(page.getByRole("heading", { name: "Lyrics", level: 1 })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "SmartBridge services" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Lyrics" })).toHaveAttribute(
    "aria-current",
    "page",
  )
  await expect(page.locator(".app-shell-sidebar")).toHaveCount(0)

  await page.getByLabel("Melody section").selectOption({ label: "Chorus" })
  await expect(page.getByText("Lead vocal melody · Chorus lift ready.")).toBeVisible()
  await page.getByLabel("Title").fill("Run Toward Morning")
  await page.getByLabel("About").fill("Leaving the city at dawn for a quieter life.")
  await page.getByLabel("Theme").selectOption("Freedom")
  await page.getByLabel("Mood").selectOption("Uplifting")
  await page.getByRole("button", { name: "Generate lyrics" }).click()

  await expect(page.getByRole("heading", { name: "Lyrics & note assignment" })).toBeVisible()
  await expect(page.getByLabel("Word line-1")).toHaveValue("City")
  await expect(page.getByText("A4", { exact: true }).first()).toBeVisible()

  await page.getByLabel("Word line-1").fill("Morning")
  await page.getByLabel("Syllable line-1").fill("Morn-ing")
  await page.getByRole("button", { name: "Re-fit after edits" }).click()
  await expect(page.getByText("Edited lyrics re-fitted to the melody")).toBeVisible()

  await page.getByRole("button", { name: "Audition" }).click()
  await expect(page.getByText("Audition ready · melody with lyric guide")).toBeVisible()
  await expect(page.getByText("Audition ready", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Prepare export" }).click()
  await expect(page.getByText("Export prepared", { exact: true }).first()).toBeVisible()
  await page.getByRole("button", { name: "Save lyrics" }).click()
  await expect(page.getByText("Lyrics saved for Chorus")).toBeVisible()

  await page.getByLabel("Word line-1").fill("Changed")
  await page.getByRole("button", { name: "Reopen saved" }).click()
  await expect(page.getByLabel("Word line-1")).toHaveValue("Morning")
  await expect(page.getByText("Lyrics saved for Chorus")).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)

  await page.screenshot({
    path: "/tmp/paid-lyrics-ui.png",
    fullPage: true,
  })
})
