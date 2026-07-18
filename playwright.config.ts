import { defineConfig, devices } from "@playwright/test"

const hardwareOptIn = process.env.SMARTBRIDGE_HARDWARE_TEST === "1"

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : "list",
  testIgnore: hardwareOptIn ? undefined : ["**/hardware.spec.ts"],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: process.env.CI ? "retain-on-failure" : "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "tablet", use: { ...devices["iPad Pro 11"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npm run build && npm run start -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/demo",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
