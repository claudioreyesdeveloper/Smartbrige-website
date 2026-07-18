import { describe, expect, it } from "vitest"
import { profileFromUniversalIdentity } from "@/lib/yamaha/profiles"
import {
  ALL_REFRESH_REPLIES,
  ALL_REFRESH_REQUESTS,
  buildRefreshRequests,
  essentialControlMessages,
  MIXER_CHANNEL_FIXTURES,
  MODEL_SELECTION_FIXTURES,
  repliesForRequests,
  shouldPreferRecentCcVolume,
  SUPPORTED_MIXER_MODELS,
  VERIFIED_MIXER_GOLDEN,
  VerifiedMockMixerAdapter,
  xgPartForUiChannel,
} from "@/tests/unit/yamaha/mixer-fixtures"

describe("A32 desktop golden metadata", () => {
  it("contains only supported models and evidence-backed values", () => {
    expect(SUPPORTED_MIXER_MODELS).toEqual(["genos", "genos2", "tyros4", "tyros5"])
    expect(VERIFIED_MIXER_GOLDEN.channelCount).toBe(32)
    expect(VERIFIED_MIXER_GOLDEN.evidence.length).toBeGreaterThanOrEqual(7)
    VERIFIED_MIXER_GOLDEN.evidence.forEach((entry) => {
      expect(entry.source).toBeTruthy()
      expect(entry.symbols.length).toBeGreaterThan(0)
      expect(entry.facts.length).toBeGreaterThan(0)
    })
    VERIFIED_MIXER_GOLDEN.unknowns.forEach((entry) => {
      expect(entry.topic).toBeTruthy()
      expect(entry.reason).toBeTruthy()
      expect(entry).not.toHaveProperty("value")
      expect(entry).not.toHaveProperty("bytes")
    })
  })

  it("provides verified identity streams and keeps Tyros4 reply UNKNOWN", () => {
    expect(MODEL_SELECTION_FIXTURES.map((fixture) => fixture.model)).toEqual(
      SUPPORTED_MIXER_MODELS,
    )
    expect(MODEL_SELECTION_FIXTURES.every((fixture) => fixture.identityRequest.length === 6)).toBe(
      true,
    )
    MODEL_SELECTION_FIXTURES.filter((fixture) => fixture.identityReply).forEach((fixture) => {
      expect(profileFromUniversalIdentity(Uint8Array.from(fixture.identityReply!))?.id).toBe(
        fixture.model,
      )
    })
    expect(
      MODEL_SELECTION_FIXTURES.find((fixture) => fixture.model === "tyros4"),
    ).not.toHaveProperty("identityReply")
  })

  it("uses current canonical offsets and records conflicting A05 values as UNKNOWN", () => {
    expect(VERIFIED_MIXER_GOLDEN.parameters.pan).toBe(0x0e)
    expect(VERIFIED_MIXER_GOLDEN.parameters.reverb).toBe(0x13)
    expect(
      VERIFIED_MIXER_GOLDEN.unknowns.some((entry) =>
        entry.topic.includes("A05 legacy pan and reverb"),
      ),
    ).toBe(true)
  })

  it("captures the exact desktop refresh progress contract", () => {
    expect(VERIFIED_MIXER_GOLDEN.refreshProgress.map((stage) => stage.value)).toEqual([
      0, 0.15, 0.35, 0.55, 0.85, 1,
    ])
    expect(VERIFIED_MIXER_GOLDEN.timing.songZeroReplyTimeoutMs).toBe(1800)
    expect(VERIFIED_MIXER_GOLDEN.timing.refreshSafetyTimeoutMs).toBe(5000)
  })
})

describe("A32 32-channel control fixtures", () => {
  it("covers every UI channel and both strict output ports", () => {
    expect(MIXER_CHANNEL_FIXTURES).toHaveLength(32)
    expect(MIXER_CHANNEL_FIXTURES.map((channel) => channel.uiChannel)).toEqual(
      Array.from({ length: 32 }, (_, index) => index + 1),
    )
    expect(MIXER_CHANNEL_FIXTURES.filter((channel) => channel.outputPort === "port2")).toHaveLength(
      16,
    )
    expect(MIXER_CHANNEL_FIXTURES.filter((channel) => channel.outputPort === "port1")).toHaveLength(
      16,
    )
  })

  it("creates all essential desktop control messages for all channels", () => {
    const all = MIXER_CHANNEL_FIXTURES.map(essentialControlMessages)
    all.forEach((controls) => {
      expect(Object.keys(controls).sort()).toEqual([
        "chorus",
        "mute",
        "pan",
        "reverb",
        "voice",
        "volume",
      ])
      expect(controls.voice).toHaveLength(3)
      expect(controls.mute).toHaveLength(1)
    })
    expect(all.flatMap((controls) => Object.values(controls).flat())).toHaveLength(256)
  })

  it("routes Style controls as SysEx and Song controls as channel MIDI", () => {
    const style = essentialControlMessages(MIXER_CHANNEL_FIXTURES[0])
    const song = essentialControlMessages(MIXER_CHANNEL_FIXTURES[16])
    expect(style.pan[0]).toEqual([0xf0, 0x43, 0x10, 0x4c, 0x08, 0x01, 0x0e, 21, 0xf7])
    expect(style.reverb[0][6]).toBe(0x13)
    expect(style.mute[0].at(-2)).toBe(0)
    expect(song.volume[0]).toEqual([0xb0, 7, 37])
    expect(song.pan[0]).toEqual([0xb0, 10, 37])
    expect(song.mute[0]).toEqual([0xb0, 7, 0])
  })
})

describe("A32 refresh request/reply streams", () => {
  it("generates the exact unique-part request counts for both banks", () => {
    const style = buildRefreshRequests("style")
    const song = buildRefreshRequests("song")
    expect(style).toHaveLength(105)
    expect(song).toHaveLength(112)
    expect(style.filter((message) => message.kind === "bulk")).toHaveLength(15)
    expect(song.filter((message) => message.kind === "bulk")).toHaveLength(16)
    expect(ALL_REFRESH_REQUESTS).toHaveLength(217)
    expect(ALL_REFRESH_REPLIES).toHaveLength(217)
  })

  it("keeps shared part 0x08 authoritative on UI channel 9", () => {
    expect(xgPartForUiChannel(8)).toBe(0x08)
    expect(xgPartForUiChannel(9)).toBe(0x08)
    const style = buildRefreshRequests("style")
    const shared = style.filter((request) => request.part === 0x08)
    expect(shared).toHaveLength(7)
    expect(shared.every((request) => request.uiChannel === 9)).toBe(true)
    expect(style.some((request) => request.uiChannel === 8)).toBe(false)
  })

  it("emits complete SysEx request and reply envelopes on strict output ports", () => {
    ALL_REFRESH_REQUESTS.forEach((request) => {
      expect(request.bytes[0]).toBe(0xf0)
      expect(request.bytes.at(-1)).toBe(0xf7)
      expect(request.port).toBe(request.bank === "style" ? "port2" : "port1")
    })
    repliesForRequests(ALL_REFRESH_REQUESTS).forEach((reply) => {
      expect(reply.bytes[0]).toBe(0xf0)
      expect(reply.bytes.at(-1)).toBe(0xf7)
    })
  })
})

describe("A32 mocked correlation and failure scenarios", () => {
  const requests = ALL_REFRESH_REQUESTS
  const replies = ALL_REFRESH_REPLIES
  const adapter = new VerifiedMockMixerAdapter()

  it("accepts complete in-order and out-of-order correlated replies", () => {
    const happy = adapter.run(requests, replies, "happy")
    expect(happy.pendingReplyIds).toHaveLength(0)
    expect(happy.appliedReplyIds).toHaveLength(217)

    const outOfOrder = adapter.run(requests, replies, "out-of-order")
    expect(outOfOrder.pendingReplyIds).toHaveLength(0)
    expect(outOfOrder.appliedReplyIds).toHaveLength(217)
  })

  it("rejects stale generation replies without consuming the current request", () => {
    const result = adapter.run(requests, replies, "stale")
    expect(result.ignoredReplyIds).toHaveLength(1)
    expect(result.pendingReplyIds).toHaveLength(1)
    expect(result.appliedReplyIds).toHaveLength(216)
  })

  it("exposes timeout and disconnect without inferring success", () => {
    const timeout = adapter.run(requests, replies, "timeout")
    expect(timeout.timedOut).toBe(true)
    expect(timeout.pendingReplyIds).toHaveLength(217)
    expect(timeout.appliedReplyIds).toHaveLength(0)

    const disconnect = adapter.run(requests, replies, "disconnect")
    expect(disconnect.disconnected).toBe(true)
    expect(disconnect.pendingReplyIds.length).toBeGreaterThan(0)
    expect(disconnect.appliedReplyIds.length).toBeLessThan(217)
  })

  it("prefers a conflicting recent CC7 but accepts equal, near, or stale replies", () => {
    expect(shouldPreferRecentCcVolume(101, 100, 80)).toBe(true)
    expect(shouldPreferRecentCcVolume(101, 100, 100)).toBe(false)
    expect(shouldPreferRecentCcVolume(101, 3001, 80)).toBe(false)
    expect(shouldPreferRecentCcVolume(null, 0, 80)).toBe(false)

    const result = adapter.run(requests, replies, "recent-cc-conflict")
    expect(result.volume[1]).toBe(101)
    expect(
      result.ignoredReplyIds.some((id) => id.includes(":style:1:param:8:11")),
    ).toBe(true)
  })
})
