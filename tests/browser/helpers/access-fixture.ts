import type { Page } from "@playwright/test"
import {
  ACCESS_FIXTURE_COOKIE,
  encodeAccessFixtureCookie,
  type AccessFixturePayload,
} from "../../../lib/access/fixture"

export const DEFAULT_ACCESS_FIXTURE: AccessFixturePayload = {
  userId: "fixture-user",
  email: "fixture@example.com",
  entitlements: [
    { serviceKey: "jam-player", status: "active" },
    { serviceKey: "genos-mixer", status: "active" },
    { serviceKey: "bass-drums", status: "canceled" },
  ],
}

export async function applyAccessFixture(
  page: Page,
  payload: AccessFixturePayload = DEFAULT_ACCESS_FIXTURE,
): Promise<void> {
  await page.context().addCookies([
    {
      name: ACCESS_FIXTURE_COOKIE,
      value: encodeAccessFixtureCookie(payload),
      url: "http://127.0.0.1:3000",
      httpOnly: false,
      sameSite: "Lax",
    },
  ])
}
