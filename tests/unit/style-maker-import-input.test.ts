import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("Style Maker template file input mounting", () => {
  it("keeps the hidden file input outside Section setup CollapsibleCard", () => {
    const src = readFileSync("components/style-maker/style-maker-app.tsx", "utf8")
    const alwaysMounted = src.indexOf("Always mounted — Section setup CollapsibleCard")
    const templateRef = src.indexOf("ref={templateInput}")
    const sectionSetup = src.indexOf('title="Section setup"')
    const nestedInputAfterButton = src.indexOf(
      "Import style-template…\n                </button>\n                <input\n                  ref={templateInput}",
    )

    expect(alwaysMounted).toBeGreaterThan(-1)
    expect(templateRef).toBeGreaterThan(-1)
    expect(sectionSetup).toBeGreaterThan(-1)
    expect(templateRef).toBeLessThan(sectionSetup)
    expect(nestedInputAfterButton).toBe(-1)
  })
})
