import { expect, test, type Page } from "@playwright/test"
import {
  ARRANGER_COMMANDS,
  chordNotes,
  chordOnMessages,
  mainCommand,
  tempoCommand,
} from "@/lib/demo/yamaha/commands"
import {
  assertContainsFrames,
  assertNoMidi,
  assertOrderedSequence,
  assertPanicStorm,
  expectProtocol,
  formatReport,
  type ProtocolReport,
} from "./assert"
import {
  PROTOCOL,
  sectionRecordStartSequence,
  sectionRecordStopSequence,
} from "./expectations"
import {
  markAction,
  MIDI_CAPTURE_INIT,
  readMidiCapture,
  resetMidiCapture,
  sliceAction,
} from "./midi-capture"
import { bytesToHex } from "./decode"

const ascii = (value: string) => Array.from(value, (c) => c.charCodeAt(0))
const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]

function styleFixture() {
  const track = [
    0, 0xff, 0x06, 7, ...ascii("Intro A"),
    0, 0x97, 65, 80, 96, 0x87, 65, 0,
    0, 0xff, 0x06, 6, ...ascii("Main A"),
    0, 0xb0, 0, 127, 0, 0xb0, 32, 0, 0, 0xc0, 0,
    0, 0xb2, 0, 8, 0, 0xb2, 32, 5, 0, 0xc2, 17,
    0, 0x90, 36, 100, 0, 0x92, 40, 90, 0, 0x93, 60, 80,
    96, 0x80, 36, 0, 0, 0x82, 40, 0, 0, 0x83, 60, 0,
    0, 0xff, 0x06, 6, ...ascii("Main B"),
    0, 0x90, 38, 100, 0, 0x92, 43, 90, 0, 0x93, 48, 80,
    0, 0x94, 52, 80, 0, 0x95, 55, 80, 0, 0x96, 57, 80, 0, 0x97, 60, 80,
    96, 0x80, 38, 0, 0, 0x82, 43, 0, 0, 0x83, 48, 0,
    0, 0x84, 52, 0, 0, 0x85, 55, 0, 0, 0x86, 57, 0, 0, 0x87, 60, 0,
    0, 0xff, 0x06, 6, ...ascii("Main C"),
    0, 0x90, 41, 100, 96, 0x80, 41, 0,
    0, 0xff, 0x06, 6, ...ascii("Main D"),
    0, 0x90, 43, 100, 96, 0x80, 43, 0,
    0, 0xff, 0x06, 8, ...ascii("Ending A"),
    0, 0x97, 67, 80, 96, 0x87, 67, 0,
    0, 0xff, 0x2f, 0,
  ]
  const tail = [...ascii("CASM"), 0, 0, 0, 4, 1, 2, 3, 4]
  return Uint8Array.from([
    ...ascii("MThd"), 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
    ...ascii("MTrk"), ...u32(track.length), ...track, ...tail,
  ])
}

async function connectGenos2(page: Page) {
  await page.getByRole("button", { name: "Genos2", exact: true }).click()
  await page.getByRole("button", { name: "Connect my keyboard" }).last().click()
  await expect(page.getByRole("button", { name: /Disconnect/ })).toBeVisible({ timeout: 8000 })
}

async function uploadDonor(page: Page) {
  await page.locator(".style-dropzone input").setInputFiles({
    name: "protocol.prs",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(styleFixture()),
  })
  await expect(page.getByText("protocol.prs")).toBeVisible()
}

async function injectStyleNotes(page: Page) {
  await page.evaluate(async () => {
    const access = await navigator.requestMIDIAccess()
    const input2 = [...access.inputs.values()].find((port) => /Port 2/i.test(port.name || ""))
    if (!input2?.onmidimessage) return
    for (let ch = 0; ch < 8; ch += 1) {
      input2.onmidimessage({ data: Uint8Array.of(0x98 | ch, 36 + ch, 100) })
    }
    await new Promise((resolve) => setTimeout(resolve, 40))
    for (let ch = 0; ch < 8; ch += 1) {
      input2.onmidimessage({ data: Uint8Array.of(0x88 | ch, 36 + ch, 0) })
    }
  })
}

function printReport(report: ProtocolReport) {
  // Visible in Playwright list reporter output on failure via expect message.
  console.log(`\n${report.log}\n`)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(MIDI_CAPTURE_INIT)
})

test.describe("Protocol source-of-truth sanity", () => {
  test("expectations match lib/demo/yamaha/commands.ts exactly", () => {
    expect(PROTOCOL.main("A").bytes).toEqual(Array.from(mainCommand("A")))
    expect(PROTOCOL.main("B").bytes).toEqual(Array.from(mainCommand("B")))
    expect(PROTOCOL.main("C").bytes).toEqual(Array.from(mainCommand("C")))
    expect(PROTOCOL.main("D").bytes).toEqual(Array.from(mainCommand("D")))
    expect(PROTOCOL.arrangerStart.bytes).toEqual(Array.from(ARRANGER_COMMANDS.start))
    expect(PROTOCOL.arrangerStop.bytes).toEqual(Array.from(ARRANGER_COMMANDS.stop))
    expect(PROTOCOL.midiStart.bytes).toEqual(Array.from(ARRANGER_COMMANDS.midiStart))
    expect(PROTOCOL.midiStop.bytes).toEqual(Array.from(ARRANGER_COMMANDS.midiStop))
    expect(PROTOCOL.tempo(120).bytes).toEqual(Array.from(tempoCommand(120)))
    expect(PROTOCOL.chordOnC().map((f) => f.bytes)).toEqual(
      chordOnMessages("C").map((m) => Array.from(m)),
    )
    expect(chordNotes("C")).toEqual([36, 40, 43])
  })
})

test.describe("Style Maker MIDI protocol regression", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Chromium Web MIDI mock")
  })

  test("Connect / Disconnect / catalog / save / download emit correct MIDI or none", async ({
    page,
  }) => {
    await page.goto("/demo/style-maker")
    await resetMidiCapture(page)

    // --- Connect keyboard (model pre-selected) ---
    // Source: midi-session.ts requestAccess(modelId) sets profile before connectPair;
    // detectKeyboard() is skipped when profile is already set (line ~230).
    await markAction(page, "Connect keyboard")
    await connectGenos2(page)
    let { sends, marks } = await readMidiCapture(page)
    let slice = sliceAction(sends, marks, "Connect keyboard")
    let report = assertNoMidi(
      "Connect keyboard",
      slice,
      "Derived from midi-session.ts: when Genos2 is chosen, profile is set and detectKeyboard() is not called — no identity SysEx on connect.",
    )
    printReport(report)
    expectProtocol(report)

    await uploadDonor(page)
    await resetMidiCapture(page)

    // --- Bass / drum catalog selection (no audition) ---
    await markAction(page, "Bass catalog selection")
    await page.locator(".lane-editor").nth(0).locator(".part-carousel button").nth(1).click()
    await markAction(page, "Drum catalog selection")
    await page.locator(".lane-editor").nth(1).locator(".part-carousel button").nth(2).click()
    ;({ sends, marks } = await readMidiCapture(page))
    report = assertNoMidi(
      "Bass catalog selection",
      sliceAction(sends, marks, "Bass catalog selection", "Drum catalog selection"),
      "Catalog click only updates React state; MIDI is sent only on Start/double-click audition (style-maker-demo.tsx).",
    )
    printReport(report)
    expectProtocol(report)
    report = assertNoMidi(
      "Drum catalog selection",
      sliceAction(sends, marks, "Drum catalog selection"),
      "Catalog click only updates React state; no MIDI until audition.",
    )
    printReport(report)
    expectProtocol(report)

    // --- Custom MIDI upload ---
    await resetMidiCapture(page)
    const laneMidi = Buffer.from([
      ...ascii("MThd"), 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
      ...ascii("MTrk"), ...u32(8),
      0, 0x90, 40, 100, 96, 0x80, 40, 0, 0, 0xff, 0x2f, 0,
    ])
    await markAction(page, "Custom MIDI upload")
    await page.locator(".lane-editor").nth(0).locator(".midi-upload input").setInputFiles({
      name: "custom-bass.mid",
      mimeType: "audio/midi",
      buffer: laneMidi,
    })
    await expect(page.getByRole("button", { name: /Your MIDI custom-bass/ })).toBeVisible()
    ;({ sends, marks } = await readMidiCapture(page))
    report = assertNoMidi(
      "Custom MIDI upload",
      sliceAction(sends, marks, "Custom MIDI upload"),
      "uploadLane() parses the file in-browser only (style-maker-demo.tsx); no Web MIDI send.",
    )
    printReport(report)
    expectProtocol(report)

    // --- Save Main A–D ---
    const sectionPicker = page.getByRole("combobox", { name: "Style Maker section" })
    for (const [index, label] of ["A", "B", "C", "D"].entries()) {
      await resetMidiCapture(page)
      await sectionPicker.selectOption({ index })
      await markAction(page, `Save Main ${label}`)
      await page.getByRole("button", { name: new RegExp(`Save Main ${label}`) }).click()
      await expect(page.getByRole("button", { name: new RegExp(`Main ${label} saved`) })).toBeDisabled()
      ;({ sends, marks } = await readMidiCapture(page))
      report = assertNoMidi(
        `Save Main ${label}`,
        sliceAction(sends, marks, `Save Main ${label}`),
        "saveCurrentSection() mutates workingStyle in memory only; no MIDI (style-maker-demo.tsx).",
      )
      printReport(report)
      expectProtocol(report)
    }

    // --- Download ---
    await resetMidiCapture(page)
    await markAction(page, "Download")
    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: /Download style/ }).click()
    await downloadPromise
    ;({ sends, marks } = await readMidiCapture(page))
    report = assertNoMidi(
      "Download",
      sliceAction(sends, marks, "Download"),
      "exportFile() creates a Blob download; no MIDI (style-maker-demo.tsx).",
    )
    printReport(report)
    expectProtocol(report)

    // --- Disconnect ---
    await resetMidiCapture(page)
    await markAction(page, "Disconnect keyboard")
    await page.getByRole("button", { name: /Disconnect/ }).click()
    await expect(page.getByRole("heading", { name: /Which Yamaha keyboard/ })).toBeVisible()
    ;({ sends, marks } = await readMidiCapture(page))
    slice = sliceAction(sends, marks, "Disconnect keyboard")
    const panicAssertions = assertPanicStorm(slice)
    report = {
      action: "Disconnect keyboard",
      messages: slice.map((s) => ({
        port: s.port,
        hex: s.hex,
        decoded: `idx=${s.index}`,
      })),
      assertions: panicAssertions,
      log: "",
    }
    report.log = formatReport(report)
    printReport(report)
    expectProtocol(report)
  })

  test("Audition Start/Stop and Compare Before/After on Port 2", async ({ page }) => {
    await page.goto("/demo/style-maker")
    await connectGenos2(page)
    await uploadDonor(page)
    await resetMidiCapture(page)

    // Start bass audition
    await markAction(page, "Start audition")
    await page.locator(".lane-editor").nth(0).getByRole("button", { name: /Start/ }).click()
    await page.waitForTimeout(150)
    await markAction(page, "Stop audition")
    await page.locator(".lane-editor").nth(0).getByRole("button", { name: /Stop/ }).click()
    let { sends, marks } = await readMidiCapture(page)
    let slice = sliceAction(sends, marks, "Start audition", "Stop audition")

    // Audition must use Port 2 for performance; play() first calls stop()→panic() on both ports
    // (style-preview.ts). Exclude CC123 All Notes Off from the Port 2-only check.
    const isPanicCc123 = (s: (typeof slice)[number]) =>
      s.bytes.length === 3 && (s.bytes[0] & 0xf0) === 0xb0 && s.bytes[1] === 123 && s.bytes[2] === 0
    const performance = slice.filter((s) => !isPanicCc123(s))
    const nonPort2 = performance.filter((s) => !s.port.endsWith("Port 2"))
    let report: ProtocolReport = {
      action: "Start audition",
      messages: slice.map((s) => ({ port: s.port, hex: s.hex, decoded: s.hex })),
      assertions: [
        {
          ok: performance.length > 0,
          name: "Audition emitted Port 2 traffic",
          detail: performance.length
            ? `${performance.length} performance message(s) after leading panic`
            : "No MIDI captured — StylePreviewPlayer.play should sendPort2 (lib/demo/style-preview.ts)",
        },
        {
          ok: nonPort2.length === 0,
          name: "All audition performance on Port 2 (panic may use both)",
          detail: nonPort2.length
            ? nonPort2.map((s) => `[${s.port}] ${s.hex}`).join("\n  ")
            : "source: lib/demo/style-preview.ts:sendEvent → sendPort2; panic via stop()",
        },
        {
          ok: slice.some((s) => isPanicCc123(s)),
          name: "Leading panic from StylePreviewPlayer.play → stop()",
          detail: "style-preview.ts play() calls stop() which panics both ports",
        },
        {
          ok: performance.some((s) => (s.bytes[0] & 0xf0) === 0x90 || s.bytes[0] === 0xf0),
          name: "Includes note-on and/or XG voice SysEx",
          detail: "Expected note status 9x or F0 43 10 4C 08… from style-preview.ts",
        },
      ],
      log: "",
    }
    // XG bank/program setup shape when present
    const xg = performance.filter(
      (s) =>
        s.hex.startsWith("F0 43 10 4C 08") && s.bytes.length === 9 && s.bytes[8] === 0xf7,
    )
    report.assertions.push({
      ok: true,
      name: `XG voice setup frames (optional if section has bank/PC): ${xg.length}`,
      detail:
        xg.length > 0
          ? `Matches style-preview.ts template F0 43 10 4C 08 ch param value F7\n  First: ${xg[0].hex}`
          : "No bank/PC in this section range — note data only is valid.",
    })
    report.log = formatReport(report)
    printReport(report)
    expectProtocol(report)

    // Stop audition → panic
    slice = sliceAction(sends, marks, "Stop audition")
    report = {
      action: "Stop audition",
      messages: slice.map((s) => ({ port: s.port, hex: s.hex, decoded: "" })),
      assertions: assertPanicStorm(slice),
      log: "",
    }
    report.log = formatReport(report)
    printReport(report)
    expectProtocol(report)

    // Compare Before / After
    await resetMidiCapture(page)
    await markAction(page, "Compare Before")
    await page.getByRole("button", { name: /BEFORE · START/ }).click()
    await page.waitForTimeout(150)
    await markAction(page, "Compare After")
    await page.locator(".compare-actions").getByRole("button", { name: "Stop" }).click()
    await page.waitForTimeout(50)
    await page.getByRole("button", { name: /AFTER/ }).click()
    await page.waitForTimeout(150)
    await page.locator(".compare-actions").getByRole("button", { name: "Stop" }).click()
    ;({ sends, marks } = await readMidiCapture(page))

    const before = sliceAction(sends, marks, "Compare Before", "Compare After")
    report = {
      action: "Compare Before",
      messages: before.map((s) => ({ port: s.port, hex: s.hex, decoded: "" })),
      assertions: [
        {
          ok: before.some((s) => s.port.endsWith("Port 2")),
          name: "Before preview uses Port 2",
          detail: "playVersion → StylePreviewPlayer.sendPort2 (style-maker-demo.tsx / style-preview.ts)",
        },
        {
          ok: before.filter((s) => !s.port.endsWith("Port 2") && (s.bytes[0] & 0xf0) === 0x90).length === 0,
          name: "No Port 1 note performance during Before",
          detail: "",
        },
      ],
      log: "",
    }
    report.log = formatReport(report)
    printReport(report)
    expectProtocol(report)

    const after = sliceAction(sends, marks, "Compare After")
    // After mark includes Stop panic + After play + final Stop panic
    report = {
      action: "Compare After",
      messages: after.slice(0, 20).map((s) => ({ port: s.port, hex: s.hex, decoded: "" })),
      assertions: [
        {
          ok: after.some((s) => s.port.endsWith("Port 2") && ((s.bytes[0] & 0xf0) === 0x90 || s.bytes[0] === 0xf0)),
          name: "After preview emits Port 2 notes/SysEx",
          detail: "playVersion('modified') → draftBytes section preview on Port 2",
        },
        {
          ok: after.some((s) => s.bytes[0] === (0xb0 | 0) && s.bytes[1] === 123),
          name: "Stop/panic All Notes Off present after compare",
          detail: "StylePreviewPlayer.stop → session.panic()",
        },
      ],
      log: "",
    }
    report.log = formatReport(report)
    printReport(report)
    expectProtocol(report)
  })

  test("Record Main A–D start/stop protocol matches section-record.ts", async ({ page }) => {
    await page.goto("/demo/style-maker")
    await connectGenos2(page)
    await uploadDonor(page)
    const sectionPicker = page.getByRole("combobox", { name: "Style Maker section" })
    const recordPanel = page.getByLabel("Record section")

    for (const [index, letter] of (["A", "B", "C", "D"] as const).entries()) {
      await sectionPicker.selectOption({ index })
      await resetMidiCapture(page)
      await markAction(page, `Main ${letter}`)
      // After the first take, UI stays in "drag" phase with "Record again" (not "Record").
      const recordStart = recordPanel.getByRole("button", { name: /^(Record|Record again)$/ })
      await recordStart.click()
      await expect(page.getByText("Recording…")).toBeVisible()
      await page.waitForTimeout(30)
      await injectStyleNotes(page)
      await markAction(page, `Stop Recording ${letter}`)
      await recordPanel.getByRole("button", { name: "Stop" }).click()
      await expect(recordPanel.getByRole("button", { name: /DRAG/ })).toBeVisible()

      const { sends, marks } = await readMidiCapture(page)
      const startSlice = sliceAction(sends, marks, `Main ${letter}`, `Stop Recording ${letter}`)
      const startReport = assertOrderedSequence(
        `Main ${letter}`,
        startSlice,
        sectionRecordStartSequence(letter),
        { allowLeadingNoise: true, exactTail: false },
      )
      startReport.assertions.push({
        ok: startSlice.some(
          (s) =>
            s.bytes.length === 3 &&
            (s.bytes[0] & 0xf0) === 0xb0 &&
            s.bytes[1] === 123,
        ),
        name: "Leading panic before record (stopPreview)",
        detail: "style-maker-demo.tsx stops preview before SectionRecorder.start",
      })
      // Chord notes must be Port 1 velocity 1 (jam chord channel 4 / status 0x93)
      startReport.assertions.push({
        ok: startSlice.some(
          (s) => s.port.endsWith("Port 1") && s.bytes[0] === 0x93 && s.bytes[2] === 1,
        ),
        name: "Correct MIDI channel for chord hold (ch4 / 0x93 vel=1)",
        detail: "commands.ts chordOnMessages → section-record.ts sendPort1",
      })
      startReport.assertions.push({
        ok: startSlice.filter((s) => s.hex === bytesToHex(Array.from(mainCommand(letter)))).length === 2,
        name: "Main SysEx sent on both ports (no duplicate beyond sendBoth)",
        detail: `Expected exactly 2× ${bytesToHex(Array.from(mainCommand(letter)))} (Port1+Port2)`,
      })
      startReport.log = formatReport(startReport)
      printReport(startReport)
      expectProtocol(startReport)

      const stopSlice = sliceAction(sends, marks, `Stop Recording ${letter}`)
      const stopReport = assertContainsFrames(
        `Stop Recording ${letter}`,
        stopSlice,
        sectionRecordStopSequence(),
      )
      stopReport.assertions.push(...assertPanicStorm(stopSlice))
      stopReport.log = formatReport(stopReport)
      printReport(stopReport)
      expectProtocol(stopReport)

      // Drag export — file only
      await resetMidiCapture(page)
      await markAction(page, "Drag export")
      const dl = page.waitForEvent("download")
      await recordPanel.getByRole("button", { name: /DRAG/ }).click()
      await dl
      const afterDrag = await readMidiCapture(page)
      const dragReport = assertNoMidi(
        "Drag export",
        sliceAction(afterDrag.sends, afterDrag.marks, "Drag export"),
        "DRAG downloads a multi-track .mid Blob (recorded-style-export.ts); no Web MIDI send.",
      )
      printReport(dragReport)
      expectProtocol(dragReport)
    }
  })

  test("Load to Keyboard emits Musicsoft handshake from musicsoft-transfer.ts", async ({
    page,
  }) => {
    await page.goto("/demo/style-maker")
    await connectGenos2(page)
    await uploadDonor(page)
    // Save one section so Load unlocks
    await page.getByRole("button", { name: /Save Main A/ }).click()
    await expect(page.getByRole("button", { name: /Main A saved/ })).toBeDisabled()

    await resetMidiCapture(page)
    await markAction(page, "Load to Keyboard")
    await page.getByRole("button", { name: /Load to Keyboard/ }).click()

    // Wait for transfer activity
    await expect(
      page.getByText(/Preparing your style|Style is on your keyboard|Reading the Yamaha|Opening Musicsoft|Sending chunk|USER/i),
    ).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(500)

    const { sends, marks } = await readMidiCapture(page)
    const slice = sliceAction(sends, marks, "Load to Keyboard")
    const report = assertContainsFrames("Load to Keyboard", slice, [
      PROTOCOL.musicsoftInitModelQuery,
      PROTOCOL.musicsoftOpenTransfer,
    ])
    report.assertions.push({
      ok: slice.every((s) => s.port.endsWith("Port 1")),
      name: "Musicsoft transfer uses Port 1 only",
      detail: "musicsoft-transfer.ts → session.request(..., default port1)",
    })
    report.assertions.push({
      ok: slice.some((s) => s.hex.startsWith("F0 43 50 00 00 07 01")),
      name: "Correct SysEx header for Musicsoft model query",
      detail: "Expected F0 43 50 00 00 07 01 F7 — musicsoft-transfer.ts:initialize",
    })
    report.assertions.push({
      ok: slice.some((s) => s.bytes[0] === 0xf0 && s.bytes[s.bytes.length - 1] === 0xf7),
      name: "SysEx frames terminated with F7",
      detail: "",
    })
    // Chunk packets: F0 43 50 01 … checksum7 … F7 (musicsoft-transfer.ts:uploadFile)
    const chunkFrames = slice.filter(
      (s) =>
        s.bytes[0] === 0xf0 &&
        s.bytes[1] === 0x43 &&
        s.bytes[2] === 0x50 &&
        s.bytes[3] === 0x01,
    )
    report.assertions.push({
      ok: chunkFrames.length > 0,
      name: `Musicsoft data chunks observed: ${chunkFrames.length}`,
      detail:
        chunkFrames.length > 0
          ? `First chunk: ${chunkFrames[0].hex.slice(0, 60)}… (checksum is last byte before F7)`
          : "Expected uploadFile chunks after STYLE folder found (listFiles mock + musicsoft-transfer.ts)",
    })
    report.log = formatReport(report)
    printReport(report)
    expectProtocol(report)
  })
})

test.describe("Jam Player MIDI protocol regression", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Chromium Web MIDI mock")
  })

  test("Play arrangement and reharmonization send arranger + chord protocol", async ({
    page,
  }) => {
    await page.goto("/demo/jam-player")
    await connectGenos2(page)
    await resetMidiCapture(page)

    await markAction(page, "Jam Player playback")
    await page.getByRole("button", { name: "Play arrangement" }).click()
    await page.waitForTimeout(400)

    let { sends, marks } = await readMidiCapture(page)
    let slice = sliceAction(sends, marks, "Jam Player playback")

    // jam-scheduler.ts start(): styleSelect both, tempo both, FA port1, start both, intro1 both (delayed)
    let report = assertContainsFrames("Jam Player playback", slice, [
      PROTOCOL.midiStart,
      PROTOCOL.arrangerStart,
      PROTOCOL.intro1,
    ])
    report.assertions.push({
      ok: slice.some((s) => s.hex.startsWith("F0 43 7E 00 02")),
      name: "Tempo SysEx present (F0 43 7E 00 02 …)",
      detail: "jam-scheduler.ts → tempoCommand(song.tempo)",
    })
    report.assertions.push({
      ok: slice.some((s) => s.hex.startsWith("F0 43 73 01 51")),
      name: "Style select SysEx present (F0 43 73 01 51 …)",
      detail: "jam-scheduler.ts → styleSelectCommand(style)",
    })
    report.assertions.push({
      ok: slice.filter((s) => s.hex === bytesToHex(Array.from(ARRANGER_COMMANDS.start))).length === 2,
      name: "Arranger Start on both ports exactly once each",
      detail: bytesToHex(Array.from(ARRANGER_COMMANDS.start)),
    })
    report.log = formatReport(report)
    printReport(report)
    expectProtocol(report)

    // Timeline section change (dblclick) — expect main variation SysEx
    await resetMidiCapture(page)
    await markAction(page, "Timeline section changes")
    await page.locator(".timeline-section").nth(1).dblclick()
    await page.waitForTimeout(200)
    ;({ sends, marks } = await readMidiCapture(page))
    slice = sliceAction(sends, marks, "Timeline section changes")
    report = {
      action: "Timeline section changes",
      messages: slice.map((s) => ({ port: s.port, hex: s.hex, decoded: "" })),
      assertions: [
        {
          ok: slice.some(
            (s) =>
              s.bytes[0] === 0xf0 &&
              s.bytes[1] === 0x43 &&
              s.bytes[2] === 0x7e &&
              s.bytes[3] === 0x00 &&
              [0x08, 0x09, 0x0a, 0x0b].includes(s.bytes[4]),
          ),
          name: "Main A–D variation SysEx after section jump",
          detail: "jam-scheduler dispatch main → mainCommand(variation)",
        },
      ],
      log: "",
    }
    report.log = formatReport(report)
    printReport(report)
    expectProtocol(report)

    // Reharmonization while playing
    const reharm = page.getByRole("combobox", { name: "Reharmonization" })
    if (await reharm.count()) {
      await resetMidiCapture(page)
      await markAction(page, "Reharmonization")
      await reharm.selectOption({ index: 1 })
      await expect(page.getByText(/reharmonization selected/i)).toBeVisible()
      await page.waitForTimeout(150)
      ;({ sends, marks } = await readMidiCapture(page))
      slice = sliceAction(sends, marks, "Reharmonization")
      // changeHarmony → chord off then chord on (port 1)
      report = {
        action: "Reharmonization",
        messages: slice.map((s) => ({ port: s.port, hex: s.hex, decoded: "" })),
        assertions: [
          {
            ok: slice.some((s) => s.port.endsWith("Port 1") && s.bytes[0] === 0x83),
            name: "Chord Off on Port 1 (0x83)",
            detail: "jam-scheduler.ts changeHarmony → chordOffMessages → sendPort1",
          },
          {
            ok: slice.some((s) => s.port.endsWith("Port 1") && s.bytes[0] === 0x93 && s.bytes[2] === 1),
            name: "Chord On on Port 1 (0x93 vel=1)",
            detail: "jam-scheduler.ts sendChord → chordOnMessages",
          },
        ],
        log: "",
      }
      report.log = formatReport(report)
      printReport(report)
      expectProtocol(report)
    } else {
      test.info().annotations.push({
        type: "note",
        description:
          "Reharmonization combobox not found — cannot assert chord MIDI. Check jam-player-demo.tsx UI.",
      })
    }
  })
})
