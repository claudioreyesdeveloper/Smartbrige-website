import { expect, test } from "@playwright/test"
import { applyAccessFixture, DEFAULT_ACCESS_FIXTURE } from "./helpers/access-fixture"

test("unauthenticated /app visitors are sent to login with a safe callback", async ({
  page,
}) => {
  await page.goto("/app/jam-player")
  await expect(page).toHaveURL(/\/login\?callbackUrl=/)
  const url = new URL(page.url())
  expect(url.searchParams.get("callbackUrl")).toBe("/app/jam-player")
  await expect(page.getByRole("heading", { name: "Sign in to SmartBridge" })).toBeVisible()
})

test("marketing and demo stay public without a session", async ({ page }, testInfo) => {
  await page.goto("/")
  await expect(page.getByRole("link", { name: "SmartBridge" }).first()).toBeVisible()

  await page.goto("/demo")
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

test("account page shows independent service statuses including canceled", async ({ page }) => {
  await applyAccessFixture(page, DEFAULT_ACCESS_FIXTURE)
  await page.goto("/app/account")

  await expect(page.getByRole("heading", { name: "Subscriptions", level: 1 })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Subscriptions", level: 2 })).toBeVisible()
  await expect(page.getByText("Signed in as fixture@example.com").first()).toBeVisible()
  await expect(page.getByText("Active").first()).toBeVisible()
  await expect(page.getByText("Canceled")).toBeVisible()
  await expect(page.getByText("Coming soon")).toBeVisible()
  await expect(page.getByRole("button", { name: "Manage in Stripe portal" })).toBeVisible()
})

test("canceling one service does not hide another active service", async ({ page }) => {
  await applyAccessFixture(page, DEFAULT_ACCESS_FIXTURE)
  await page.goto("/app")

  await expect(page.getByRole("heading", { name: "Jam Player" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Genos Mixer" })).toBeVisible()
  await page.goto("/app/jam-player")
  await expect(page.getByText(/This module shell is ready/)).toBeVisible()
  await page.goto("/app/genos-mixer")
  await expect(page.getByText(/This module shell is ready/)).toBeVisible()
})

test("upgrade CTA routes to billing for the selected service", async ({ page }) => {
  await applyAccessFixture(page, DEFAULT_ACCESS_FIXTURE)
  await page.goto("/app")
  await page.getByRole("link", { name: /Upgrade to unlock/i }).first().click()
  await expect(page).toHaveURL(/\/app\/billing\?service=/)
})
