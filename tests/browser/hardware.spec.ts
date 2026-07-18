import { expect, test } from "@playwright/test"

const mixerModels = ["Genos", "Genos2", "Tyros4", "Tyros5"] as const

test("detects a supported Yamaha keyboard over physical Web MIDI", async ({
  browserName,
  context,
  page,
}, testInfo) => {
  test.skip(process.env.SMARTBRIDGE_HARDWARE_TEST !== "1", "Physical keyboard test is opt-in")
  test.skip(!process.env.SMARTBRIDGE_HARDWARE_MODEL, "Physical keyboard model must be explicit")
  test.skip(testInfo.project.name !== "desktop", "Physical Web MIDI is tested in Chromium")
  test.skip(browserName !== "chromium", "Web MIDI requires Chromium")

  await context.grantPermissions(["midi", "midi-sysex"], {
    origin: "http://127.0.0.1:3000",
  })
  await page.goto("/demo/jam-player")
  const model = process.env.SMARTBRIDGE_HARDWARE_MODEL!
  await page.getByRole("button", { name: model, exact: true }).click()
  await page.getByRole("button", { name: "Connect my keyboard" }).last().click()
  await expect(page.locator(".keyboard-badge.is-connected")).toContainText(model, { timeout: 10000 })
  await expect(page.getByText("16 complete 4/4 arrangements")).toBeVisible()
})

for (const scenarioModel of mixerModels) {
  test(`runs the explicit ${scenarioModel} physical mixer read harness`, async ({
    browserName,
    context,
    page,
  }, testInfo) => {
    const configuredModel = process.env.SMARTBRIDGE_MIXER_HARDWARE_MODEL
    const inputPort1 = process.env.SMARTBRIDGE_MIXER_INPUT_PORT_1
    const inputPort2 = process.env.SMARTBRIDGE_MIXER_INPUT_PORT_2
    const outputPort1 = process.env.SMARTBRIDGE_MIXER_OUTPUT_PORT_1
    const outputPort2 = process.env.SMARTBRIDGE_MIXER_OUTPUT_PORT_2
    const explicitlyEnabled =
      process.env.SMARTBRIDGE_HARDWARE_TEST === "1" &&
      process.env.SMARTBRIDGE_MIXER_HARDWARE_TEST === "1"

    test.skip(!explicitlyEnabled, "Mixer hardware requires both explicit opt-in flags")
    test.skip(configuredModel !== scenarioModel, "Only the explicitly selected model runs")
    test.skip(
      !inputPort1 || !inputPort2 || !outputPort1 || !outputPort2,
      "Mixer hardware requires exact names for both input and output ports",
    )
    test.skip(testInfo.project.name !== "desktop", "Physical mixer harness is desktop-only")
    test.skip(browserName !== "chromium", "Web MIDI requires Chromium")

    await context.grantPermissions(["midi", "midi-sysex"], {
      origin: "http://127.0.0.1:3000",
    })
    await page.goto("/demo")

    const result = await page.evaluate(
      async (config) => {
        const midi = await navigator.requestMIDIAccess({ sysex: true })
        const inputs = [...midi.inputs.values()]
        const outputs = [...midi.outputs.values()]
        const input1 = inputs.find((port) => port.name === config.inputPort1)
        const input2 = inputs.find((port) => port.name === config.inputPort2)
        const output1 = outputs.find((port) => port.name === config.outputPort1)
        const output2 = outputs.find((port) => port.name === config.outputPort2)
        if (!input1 || !input2 || !output1 || !output2) {
          throw new Error("An explicitly named mixer MIDI port was not found.")
        }

        await Promise.all([input1.open(), input2.open(), output1.open(), output2.open()])
        const listeners = new Set<(data: Uint8Array) => void>()
        const receive = (event: MIDIMessageEvent) => {
          if (!event.data) return
          const data = Uint8Array.from(event.data)
          listeners.forEach((listener) => listener(data))
        }
        input1.onmidimessage = receive
        input2.onmidimessage = receive

        const request = (
          output: MIDIOutput,
          bytes: number[],
          matches: (data: Uint8Array) => boolean,
          timeoutMs = 5000,
        ) =>
          new Promise<Uint8Array>((resolve, reject) => {
            const listener = (data: Uint8Array) => {
              if (!matches(data)) return
              clearTimeout(timer)
              listeners.delete(listener)
              resolve(data)
            }
            const timer = setTimeout(() => {
              listeners.delete(listener)
              reject(new Error(`No verified reply for ${bytes.join(" ")}`))
            }, timeoutMs)
            listeners.add(listener)
            output.send(bytes)
          })

        const decodePayload7 = (data: Uint8Array) => {
          const decoded: number[] = []
          for (let offset = 0; offset < data.length; offset += 8) {
            const group = data.slice(offset, offset + 8)
            const status = group[0] ?? 0
            for (let index = 1; index < group.length; index += 1) {
              decoded.push(group[index] + (((status >> (7 - index)) & 1) ? 0x80 : 0))
            }
          }
          return new TextDecoder("latin1")
            .decode(Uint8Array.from(decoded))
            .replace(/\0.*$/, "")
            .trim()
        }

        const modelReply = await request(
          output1,
          [0xf0, 0x43, 0x50, 0x00, 0x00, 0x07, 0x01, 0xf7],
          (data) =>
            data[0] === 0xf0 &&
            data[1] === 0x43 &&
            data[2] === 0x50 &&
            data[3] === 0 &&
            data[4] === 0 &&
            data[5] === 7 &&
            data[6] === 2,
        )
        const reportedModel = decodePayload7(modelReply.slice(8, -1))
        const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")
        if (!normalize(reportedModel).includes(normalize(config.model))) {
          throw new Error(`Hardware reported ${reportedModel || "UNKNOWN"}, expected ${config.model}.`)
        }

        const readParts = async (output: MIDIOutput, port: "port1" | "port2", parts: number[]) => {
          const replies: { port: string; part: number; bytes: number[] }[] = []
          for (const part of parts) {
            const reply = await request(
              output,
              [0xf0, 0x43, 0x20, 0x4c, 0x08, part, 0x00, 0xf7],
              (data) =>
                data.length > 11 &&
                data[0] === 0xf0 &&
                data[1] === 0x43 &&
                (data[2] & 0xf0) === 0 &&
                data[3] === 0x4c &&
                data[6] === 0x08 &&
                data[7] === part &&
                data[8] === 0,
            )
            replies.push({ port, part, bytes: [...reply] })
          }
          return replies
        }

        const styleReplies = await readParts(
          output2,
          "port2",
          Array.from({ length: 15 }, (_, index) => index + 1),
        )
        const songReplies = await readParts(
          output1,
          "port1",
          Array.from({ length: 16 }, (_, index) => index),
        )

        input1.onmidimessage = null
        input2.onmidimessage = null
        await Promise.allSettled([input1.close(), input2.close(), output1.close(), output2.close()])
        return { reportedModel, styleReplies, songReplies }
      },
      {
        model: scenarioModel,
        inputPort1: inputPort1!,
        inputPort2: inputPort2!,
        outputPort1: outputPort1!,
        outputPort2: outputPort2!,
      },
    )

    expect(result.reportedModel.toLowerCase().replace(/[^a-z0-9]/g, "")).toContain(
      scenarioModel.toLowerCase(),
    )
    expect(result.styleReplies).toHaveLength(15)
    expect(result.songReplies).toHaveLength(16)
    expect(result.styleReplies.every((reply) => reply.port === "port2")).toBe(true)
    expect(result.songReplies.every((reply) => reply.port === "port1")).toBe(true)
  })
}
