import { defineConfig, devices } from "@playwright/test"

/** Smoke tests against an already-running local server (no webServer spawn). */
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  use: {
    baseURL: process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
})
