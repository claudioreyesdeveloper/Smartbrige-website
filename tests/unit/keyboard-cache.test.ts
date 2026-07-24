import { describe, expect, it } from "vitest"
import {
  resolveCachedKeyboardPair,
  type CachedKeyboardPair,
} from "@/lib/demo/yamaha/keyboard-cache"

describe("keyboard cache", () => {
  it("resolves a cached Yamaha pair by id", () => {
    const cached: CachedKeyboardPair = {
      input1Id: "in1",
      input2Id: "in2",
      output1Id: "out1",
      output2Id: "out2",
      input1Name: "Yamaha Port 1",
      input2Name: "Yamaha Port 2",
      output1Name: "Yamaha Port 1",
      output2Name: "Yamaha Port 2",
      savedAt: 1,
    }
    const pair = resolveCachedKeyboardPair(
      cached,
      [
        { id: "in1", name: "Yamaha Port 1", manufacturer: "Yamaha", state: "connected" },
        { id: "in2", name: "Yamaha Port 2", manufacturer: "Yamaha", state: "connected" },
      ],
      [
        { id: "out1", name: "Yamaha Port 1", manufacturer: "Yamaha", state: "connected" },
        { id: "out2", name: "Yamaha Port 2", manufacturer: "Yamaha", state: "connected" },
      ],
    )
    expect(pair?.input1.id).toBe("in1")
    expect(pair?.output2.id).toBe("out2")
  })

  it("falls back to port name when ids change", () => {
    const cached: CachedKeyboardPair = {
      input1Id: "old-in1",
      input2Id: "old-in2",
      output1Id: "old-out1",
      output2Id: "old-out2",
      input1Name: "Genos2 Port1",
      input2Name: "Genos2 Port2",
      output1Name: "Genos2 Port1",
      output2Name: "Genos2 Port2",
      savedAt: 1,
    }
    const pair = resolveCachedKeyboardPair(
      cached,
      [
        { id: "new-in1", name: "Genos2 Port1", manufacturer: "Yamaha", state: "connected" },
        { id: "new-in2", name: "Genos2 Port2", manufacturer: "Yamaha", state: "connected" },
      ],
      [
        { id: "new-out1", name: "Genos2 Port1", manufacturer: "Yamaha", state: "connected" },
        { id: "new-out2", name: "Genos2 Port2", manufacturer: "Yamaha", state: "connected" },
      ],
    )
    expect(pair?.input1.id).toBe("new-in1")
    expect(pair?.input2.name).toBe("Genos2 Port2")
  })
})
