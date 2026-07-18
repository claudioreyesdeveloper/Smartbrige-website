import { expect, test } from "@playwright/test"
import { applyAccessFixture } from "./helpers/access-fixture"

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop-only Genos Mixer journey")
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

test("mixes Style and Song channels, selects a voice, and reopens saved values", async ({
  page,
}) => {
  await page.goto(`${process.env.GENOS_MIXER_BASE_URL ?? ""}/app/genos-mixer`)

  await expect(page.getByRole("heading", { name: "Genos Mixer", level: 1 })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "SmartBridge services" })).toBeVisible()
  await expect(page.getByText("Genos2", { exact: true })).toBeVisible()
  await expect(page.getByRole("status").filter({ hasText: "Connected" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Style (1-16)" })).toHaveAttribute(
    "aria-selected",
    "true",
  )
  await expect(page.getByLabel("Channel 1, Right 1")).toBeVisible()
  await expect(page.getByLabel("Channel 16, Phrase 2")).toBeAttached()
  await expect(page.getByText("EQ", { exact: true })).toHaveCount(0)
  await expect(page.getByText("DSP", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Cubase", { exact: true })).toHaveCount(0)

  const rightOneVolume = page.getByLabel("Right 1 volume")
  await rightOneVolume.fill("77")
  await page.getByRole("button", { name: "Mute", exact: true }).first().click()
  await expect(page.getByRole("button", { name: "Muted", exact: true }).first())
    .toHaveAttribute("aria-pressed", "true")

  await page.getByRole("button", { name: "Choose voice for Right 1" }).click()
  await expect(page.getByRole("dialog", { name: "Select Voice" })).toBeVisible()
  await page.getByLabel("Search voices").fill("strings")
  await page.getByRole("option", { name: /Live! Strings/ }).click()
  await expect(page.getByRole("button", { name: "Choose voice for Right 1" }))
    .toContainText("Live! Strings")

  await page.getByRole("button", { name: "Save Mixer" }).click()
  await expect(page.getByText("Mixer saved in project")).toBeVisible()
  await rightOneVolume.fill("12")
  await page.getByRole("button", { name: "Reopen" }).click()
  await expect(page.getByText("Saved mixer reopened")).toBeVisible()
  await expect(rightOneVolume).toHaveValue("77")

  await page.getByRole("tab", { name: "Song (17-32)" }).click()
  await expect(page.getByLabel("Channel 17, Song 1")).toBeVisible()
  await expect(page.getByLabel("Channel 32, Song 16")).toBeAttached()

  await page.getByRole("tab", { name: "Style (1-16)" }).click()
  await page.getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(page.getByText("Mixer refreshed")).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)

  await page.locator("nextjs-portal").evaluateAll((portals) => {
    portals.forEach((portal) => portal.remove())
  })
  await page.screenshot({
    path: "/tmp/paid-genos-mixer-ui.png",
    fullPage: true,
  })
})
