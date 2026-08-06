import { describe, expect, it } from "vitest"
import { nextDialogFocusIndex } from "@/components/band-jam/player-panel-dialog"

describe("nextDialogFocusIndex", () => {
  it("wraps forward and backward inside a modal", () => {
    expect(nextDialogFocusIndex(2, 3, false)).toBe(0)
    expect(nextDialogFocusIndex(0, 3, true)).toBe(2)
  })

  it("selects an edge when focus starts outside the modal", () => {
    expect(nextDialogFocusIndex(-1, 3, false)).toBe(0)
    expect(nextDialogFocusIndex(-1, 3, true)).toBe(2)
  })
})
