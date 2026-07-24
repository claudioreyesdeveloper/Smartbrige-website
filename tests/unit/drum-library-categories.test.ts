import { describe, expect, it } from "vitest"
import {
  filterDrumLibraryCategories,
  isExcludedDrumLibraryCategory,
} from "@/lib/style-maker/drum-library-categories"

describe("drum library category excludes", () => {
  it("excludes cinematic and percussion packs", () => {
    expect(isExcludedDrumLibraryCategory("Cinematic Percussion")).toBe(true)
    expect(isExcludedDrumLibraryCategory("Latin Percussion")).toBe(true)
    expect(isExcludedDrumLibraryCategory("Funk Percussion")).toBe(true)
    expect(isExcludedDrumLibraryCategory("action_drums")).toBe(true)
    expect(isExcludedDrumLibraryCategory("Action Drums")).toBe(true)
  })

  it("keeps groove genres", () => {
    expect(isExcludedDrumLibraryCategory("Pop")).toBe(false)
    expect(isExcludedDrumLibraryCategory("Funk")).toBe(false)
    expect(isExcludedDrumLibraryCategory("Rock")).toBe(false)
    expect(isExcludedDrumLibraryCategory("Jazz")).toBe(false)
  })

  it("filters category lists", () => {
    expect(
      filterDrumLibraryCategories([
        "Pop",
        "Cinematic Percussion",
        "Funk",
        "Latin Percussion",
      ]),
    ).toEqual(["Pop", "Funk"])
  })
})
