import { expect, test } from "@playwright/test"

test("detects a supported Yamaha keyboard over physical Web MIDI", async ({
  browserName,
  context,
  page,
}, testInfo) => {
  test.skip(process.env.SMARTBRIDGE_HARDWARE_TEST !== "1", "Physical keyboard test is opt-in")
  test.skip(testInfo.project.name !== "desktop", "Physical Web MIDI is tested in Chromium")
  test.skip(browserName !== "chromium", "Web MIDI requires Chromium")

  await context.grantPermissions(["midi", "midi-sysex"], {
    origin: "http://127.0.0.1:3000",
  })
  await page.goto("/demo/jam-player")
  const result = await page.evaluate(async () => {
    const access = await navigator.requestMIDIAccess({ sysex: true })
    const input = Array.from(access.inputs.values()).find((port) => /port\s*2|[- ]2$/i.test(port.name || ""))
    const output = Array.from(access.outputs.values()).find((port) => /port\s*2|[- ]2$/i.test(port.name || ""))
    if (!input || !output) throw new Error("Yamaha Port 2 input/output pair was not exposed.")

    const timeout = <T,>(promise: Promise<T>, label: string) =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out.`)), 5000),
        ),
      ])
    await timeout(Promise.all([input.open(), output.open()]), "Opening Yamaha Port 2")

    const response = new Promise<number[]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Port 2 returned no SysEx response.")), 5000)
      input.onmidimessage = (event) => {
        if (!event.data) return
        const bytes = Array.from(event.data)
        const identity = bytes[0] === 0xf0 && bytes[1] === 0x7e && bytes[3] === 0x06 && bytes[4] === 0x02
        const musicsoft = bytes.slice(0, 7).join(",") === "240,67,80,0,0,7,2"
        if (!identity && !musicsoft) return
        clearTimeout(timer)
        resolve(bytes)
      }
      output.send([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7])
      setTimeout(() => output.send([0xf0, 0x43, 0x50, 0, 0, 7, 1, 0xf7]), 1500)
    })
    return {
      input: input.name,
      output: output.name,
      response: await response,
    }
  })

  expect(result.input).toMatch(/port\s*2|[- ]2$/i)
  expect(result.output).toMatch(/port\s*2|[- ]2$/i)
  expect(result.response[0]).toBe(0xf0)
})
