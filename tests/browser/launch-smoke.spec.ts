import { expect, test, type Page } from "@playwright/test"

const ascii = (value: string) => Array.from(new TextEncoder().encode(value))
const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

/** Minimal native Yamaha style with section markers + CASM tail. */
function styleTemplateFixture() {
  const track = [
    0, 0xff, 0x06, 7, ...ascii("Intro A"),
    0, 0x97, 65, 80, 96, 0x87, 65, 0,
    0, 0xff, 0x06, 6, ...ascii("Main A"),
    0, 0x90, 36, 100, 0, 0x92, 40, 90, 0, 0x93, 60, 80,
    96, 0x80, 36, 0, 0, 0x82, 40, 0, 0, 0x83, 60, 0,
    0, 0xff, 0x06, 6, ...ascii("Main B"),
    0, 0x90, 38, 100,
    96, 0x80, 38, 0,
    0, 0xff, 0x2f, 0,
  ]
  const tail = [...ascii("CASM"), 0, 0, 0, 4, 1, 2, 3, 4]
  return Uint8Array.from([
    ...ascii("MThd"),
    0, 0, 0, 6,
    0, 0,
    0, 1,
    0, 96,
    ...ascii("MTrk"),
    ...u32(track.length),
    ...track,
    ...tail,
  ])
}

async function mockYamahaMidi(page: Page) {
  await page.addInitScript(() => {
    const midiWindow = window as unknown as {
      __midiSends: { port: string; data: number[] }[]
    }
    midiWindow.__midiSends = []
    const makePort = (id: string, name: string) => ({
      id,
      name,
      manufacturer: "Yamaha",
      state: "connected",
      onmidimessage: null as null | ((event: { data: Uint8Array }) => void),
      open: async () => {},
      close: async () => {},
      send: (data: Uint8Array) => {
        midiWindow.__midiSends.push({ port: name, data: Array.from(data) })
      },
    })
    const input1 = makePort("yamaha-in-1", "Digital Keyboard Port 1")
    const input2 = makePort("yamaha-in-2", "Digital Keyboard Port 2")
    const output1 = makePort("yamaha-out-1", "Digital Keyboard Port 1")
    const output2 = makePort("yamaha-out-2", "Digital Keyboard Port 2")
    const replyIdentity = (data: Uint8Array) => {
      const bytes = Array.from(data)
      if (bytes.join(",") === "240,67,80,0,0,7,1,247") {
        setTimeout(() => {
          input1.onmidimessage?.({
            data: Uint8Array.from([
              0xf0, 0x43, 0x50, 0, 0, 7, 2, 0,
              0, 71, 101, 110, 111, 115, 50,
              0xf7,
            ]),
          })
        }, 0)
      }
    }
    output1.send = (data: Uint8Array) => {
      midiWindow.__midiSends.push({ port: output1.name, data: Array.from(data) })
      replyIdentity(data)
    }
    output2.send = (data: Uint8Array) => {
      midiWindow.__midiSends.push({ port: output2.name, data: Array.from(data) })
      replyIdentity(data)
    }
    Object.defineProperty(navigator, "requestMIDIAccess", {
      configurable: true,
      value: async () => ({
        inputs: new Map([
          [input1.id, input1],
          [input2.id, input2],
        ]),
        outputs: new Map([
          [output1.id, output1],
          [output2.id, output2],
        ]),
        onstatechange: null,
      }),
    })
  })
}

async function signInAsDeveloper(page: Page) {
  const email = process.env.LAUNCH_TEST_EMAIL || "claudio.private@gmail.com"
  const password = process.env.LAUNCH_TEST_PASSWORD || "Sommar10"
  await page.goto("/sign-in")
  // Clerk may already have a session.
  if (page.url().includes("/style-maker/app")) return
  await page.getByLabel(/email/i).first().fill(email)
  const continueBtn = page.getByRole("button", { name: /continue/i }).first()
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click()
  }
  const passwordField = page.getByLabel(/password/i).first()
  await passwordField.waitFor({ state: "visible", timeout: 15000 })
  await passwordField.fill(password)
  await page.getByRole("button", { name: /continue|sign in|log in/i }).first().click()
  await page.waitForURL(/style-maker\/app|\/$/, { timeout: 30000 }).catch(() => {})
}

test.describe("Launch smoke — public pages", () => {
  test("home and Style Maker landing render launch messaging", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop-only smoke")
    await page.goto("/")
    await expect(page.getByText(/Style Maker/i).first()).toBeVisible()
    await page.goto("/style-maker")
    await expect(page.getByText(/14-day|free trial|Style Maker/i).first()).toBeVisible()
    await page.goto("/demo")
    await expect(page.getByRole("link", { name: /Jam Player/i })).toBeVisible()
  })

  test("unsigned /style-maker/app redirects to sign-in", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop-only smoke")
    await page.context().clearCookies()
    await page.goto("/style-maker/app")
    await expect(page).toHaveURL(/sign-in/)
  })
})

test.describe("Launch smoke — Style Maker import regression", () => {
  test("Import style-template opens picker even when Section setup is collapsed", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop-only smoke")
    await mockYamahaMidi(page)

    // Prefer direct app access after sign-in; fall back documents failure clearly.
    await signInAsDeveloper(page)
    await page.goto("/style-maker/app")
    if (page.url().includes("sign-in")) {
      test.fail(true, "Could not reach Style Maker app — sign-in blocked or entitlement missing")
      return
    }

    await expect(page.getByText(/Style Maker/i).first()).toBeVisible({ timeout: 20000 })

    // Collapse Section setup if open (this used to unmount the file input).
    const setupToggle = page.getByRole("button", { name: /Section setup/i })
    if (await setupToggle.isVisible().catch(() => false)) {
      const expanded = await setupToggle.getAttribute("aria-expanded")
      if (expanded === "true") await setupToggle.click()
      await expect(setupToggle).toHaveAttribute("aria-expanded", "false")
    }

    // File input must remain mounted outside the collapsed card.
    const fileInput = page.locator('input[type="file"][accept*=".sty"]')
    await expect(fileInput).toHaveCount(1)

    const chooserPromise = page.waitForEvent("filechooser", { timeout: 5000 })
    await page.getByRole("button", { name: "Import style-template…" }).first().click()
    const chooser = await chooserPromise
    expect(chooser).toBeTruthy()
    await chooser.setFiles({
      name: "launch-smoke.prs",
      mimeType: "application/octet-stream",
      buffer: Buffer.from(styleTemplateFixture()),
    })

    await expect(page.getByText(/Template loaded|launch-smoke\.prs/i).first()).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText("Import a template")).toHaveCount(0)
  })
})

test.describe("Launch smoke — Jam Player demo", () => {
  test("style combobox change emits Genos2 style-select SysEx", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop-only smoke")
    await mockYamahaMidi(page)
    await page.goto("/demo/jam-player")
    await page.getByRole("button", { name: "Genos2" }).click()
    await page.getByRole("button", { name: "Connect my keyboard" }).last().click()
    await expect(page.getByPlaceholder(/Search .* styles/)).toBeVisible()

    await page.evaluate(() => {
      ;(window as unknown as { __midiSends: unknown[] }).__midiSends = []
    })
    await page.getByRole("combobox", { name: "Yamaha style" }).selectOption({ index: 2 })
    const styleSends = await page.evaluate(
      () => (window as unknown as { __midiSends: { data: number[] }[] }).__midiSends,
    )
    expect(styleSends.some(({ data }) => data.join(",") === "240,67,96,125,247")).toBe(true)
    expect(
      styleSends.some(
        ({ data }) => data.slice(0, 11).join(",") === "240,67,115,1,81,5,0,3,4,0,0",
      ),
    ).toBe(true)
  })
})
