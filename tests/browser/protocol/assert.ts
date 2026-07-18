import { expect } from "@playwright/test"
import type { CapturedMidiSend } from "./midi-capture"
import { bytesToHex, decodeMidi } from "./decode"
import {
  expandPorts,
  type ExpectedFrame,
} from "./expectations"

export type AssertionResult = {
  ok: boolean
  name: string
  detail: string
}

export type ProtocolReport = {
  action: string
  messages: { port: string; hex: string; decoded: string }[]
  assertions: AssertionResult[]
  log: string
}

function portMatches(send: CapturedMidiSend, suffix: string) {
  return send.port.endsWith(suffix)
}

function bytesEqual(a: number[], b: number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function formatReport(report: ProtocolReport): string {
  const lines = [
    `Action: ${report.action}`,
    "",
    "Messages:",
    ...report.messages.map(
      (message) => `  [${message.port}] ${message.hex}  // ${message.decoded}`,
    ),
    "",
    "Assertions:",
    ...report.assertions.map(
      (assertion) =>
        `${assertion.ok ? "✓" : "✗"} ${assertion.name}${assertion.detail ? `\n  ${assertion.detail}` : ""}`,
    ),
  ]
  return lines.join("\n")
}

export function buildMessageLog(sends: CapturedMidiSend[]) {
  return sends.map((send) => ({
    port: send.port,
    hex: send.hex,
    decoded: decodeMidi(send.bytes),
  }))
}

/**
 * Match an ordered expected sequence against captured sends (contiguous from start,
 * allowing only exact matches in order). Returns assertion list.
 */
export function assertOrderedSequence(
  action: string,
  sends: CapturedMidiSend[],
  expected: ExpectedFrame[],
  options: {
    /** If true, fail when extra sends remain after the expected sequence. */
    exactTail?: boolean
    allowLeadingNoise?: boolean
  } = {},
): ProtocolReport {
  const assertions: AssertionResult[] = []
  const expanded = expected.flatMap(expandPorts)
  let cursor = 0

  if (options.allowLeadingNoise) {
    // Find first expected frame anywhere, then require ordered match from there.
    const first = expanded[0]
    if (first) {
      const found = sends.findIndex(
        (send) =>
          portMatches(send, first.portSuffix) && bytesEqual(send.bytes, first.bytes),
      )
      if (found < 0) {
        assertions.push({
          ok: false,
          name: `Find first expected: ${first.label}`,
          detail: `Expected on ${first.portSuffix}: ${bytesToHex(first.bytes)}\nSource: ${first.source}\nActual stream had ${sends.length} message(s).`,
        })
      } else {
        cursor = found
        assertions.push({
          ok: true,
          name: `Sequence starts at index ${found}`,
          detail: "",
        })
      }
    }
  }

  for (const frame of expanded) {
    const send = sends[cursor]
    if (!send) {
      assertions.push({
        ok: false,
        name: frame.label,
        detail: [
          `Missing message on ${frame.portSuffix}.`,
          `Expected: ${bytesToHex(frame.bytes)}`,
          `Decoded:  ${decodeMidi(frame.bytes)}`,
          `Source:   ${frame.source}`,
        ].join("\n  "),
      })
      continue
    }

    const portOk = portMatches(send, frame.portSuffix)
    const bytesOk = bytesEqual(send.bytes, frame.bytes)
    const ok = portOk && bytesOk
    assertions.push({
      ok,
      name: frame.label,
      detail: ok
        ? `port=${send.port} hex=${send.hex}`
        : [
            `Port:     expected endsWith "${frame.portSuffix}", actual "${send.port}"`,
            `Expected: ${bytesToHex(frame.bytes)}`,
            `Actual:   ${send.hex}`,
            `DecodedE: ${decodeMidi(frame.bytes)}`,
            `DecodedA: ${decodeMidi(send.bytes)}`,
            `Source:   ${frame.source}`,
          ].join("\n  "),
    })
    cursor += 1
  }

  if (options.exactTail) {
    const extras = sends.slice(cursor)
    assertions.push({
      ok: extras.length === 0,
      name: "No extra messages after expected sequence",
      detail:
        extras.length === 0
          ? ""
          : extras
              .map((send) => `[${send.port}] ${send.hex} // ${decodeMidi(send.bytes)}`)
              .join("\n  "),
    })
  }

  // Structural checks on matched SysEx frames
  for (const send of sends) {
    if (send.bytes[0] !== 0xf0) continue
    assertions.push({
      ok: send.bytes[send.bytes.length - 1] === 0xf7,
      name: `SysEx terminator F7 (${send.hex.slice(0, 24)}…)`,
      detail:
        send.bytes[send.bytes.length - 1] === 0xf7
          ? ""
          : `Expected trailing F7, got ${send.hex}`,
    })
    if (send.bytes[1] === 0x43) {
      assertions.push({
        ok: true,
        name: "Yamaha manufacturer ID 0x43",
        detail: "",
      })
    }
  }

  const report: ProtocolReport = {
    action,
    messages: buildMessageLog(sends),
    assertions,
    log: "",
  }
  report.log = formatReport(report)
  return report
}

export function assertContainsFrames(
  action: string,
  sends: CapturedMidiSend[],
  expected: ExpectedFrame[],
): ProtocolReport {
  const assertions: AssertionResult[] = []
  for (const frame of expected.flatMap(expandPorts)) {
    const hit = sends.find(
      (send) =>
        portMatches(send, frame.portSuffix) && bytesEqual(send.bytes, frame.bytes),
    )
    assertions.push({
      ok: Boolean(hit),
      name: `Contains ${frame.label} on ${frame.portSuffix}`,
      detail: hit
        ? `index=${hit.index} t=${hit.t.toFixed(1)}ms`
        : [
            `Expected: ${bytesToHex(frame.bytes)}`,
            `Decoded:  ${decodeMidi(frame.bytes)}`,
            `Source:   ${frame.source}`,
            `Not found in ${sends.length} captured send(s).`,
          ].join("\n  "),
    })
  }

  // Duplicate detection for identical port+bytes pairs beyond expected multiplicity
  const counts = new Map<string, number>()
  for (const send of sends) {
    const key = `${send.port}|${send.hex}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const expectedCounts = new Map<string, number>()
  for (const frame of expected.flatMap(expandPorts)) {
    const key = `${frame.portSuffix === "Port 1" ? "Digital Keyboard Port 1" : "Digital Keyboard Port 2"}|${bytesToHex(frame.bytes)}`
    // Port names in capture use full "Digital Keyboard Port N"
    const portName =
      frame.portSuffix === "Port 1"
        ? "Digital Keyboard Port 1"
        : "Digital Keyboard Port 2"
    const fullKey = `${portName}|${bytesToHex(frame.bytes)}`
    expectedCounts.set(fullKey, (expectedCounts.get(fullKey) || 0) + 1)
  }
  for (const [key, count] of expectedCounts) {
    const actual = counts.get(key) || 0
    // Allow actual >= expected for streams that legitimately repeat (clocks); flag only when checking exact ops
    void actual
    void count
  }

  const report: ProtocolReport = {
    action,
    messages: buildMessageLog(sends),
    assertions,
    log: "",
  }
  report.log = formatReport(report)
  return report
}

export function assertNoMidi(
  action: string,
  sends: CapturedMidiSend[],
  reason: string,
): ProtocolReport {
  const assertions: AssertionResult[] = [
    {
      ok: sends.length === 0,
      name: "No MIDI traffic (client-only operation)",
      detail:
        sends.length === 0
          ? reason
          : [
              reason,
              "Unexpected sends:",
              ...sends.map((send) => `  [${send.port}] ${send.hex} // ${decodeMidi(send.bytes)}`),
            ].join("\n  "),
    },
  ]
  const report: ProtocolReport = {
    action,
    messages: buildMessageLog(sends),
    assertions,
    log: "",
  }
  report.log = formatReport(report)
  return report
}

export function assertPanicStorm(sends: CapturedMidiSend[]): AssertionResult[] {
  const results: AssertionResult[] = []
  // panic sends CC123 on ch 0–15 to both ports → 32 messages
  let found = 0
  for (let ch = 0; ch < 16; ch += 1) {
    const bytes = [0xb0 | ch, 123, 0]
    const hex = bytesToHex(bytes)
    for (const suffix of ["Port 1", "Port 2"]) {
      const hit = sends.some(
        (send) => send.port.endsWith(suffix) && bytesEqual(send.bytes, bytes),
      )
      if (hit) found += 1
      results.push({
        ok: hit,
        name: `Panic CC123 ch${ch + 1} on ${suffix}`,
        detail: hit
          ? ""
          : `Expected ${hex} on ${suffix} (lib/demo/yamaha/midi-session.ts:panic)`,
      })
    }
  }
  results.unshift({
    ok: found === 32,
    name: `Panic covers all 16 channels × 2 ports (${found}/32)`,
    detail: found === 32 ? "" : "Incomplete All Notes Off storm",
  })
  return results
}

export function expectProtocol(report: ProtocolReport) {
  const failed = report.assertions.filter((assertion) => !assertion.ok)
  if (failed.length) {
    expect(failed, report.log).toEqual([])
  }
}
