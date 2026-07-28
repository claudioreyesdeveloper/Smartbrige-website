import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  // tsconfig.json sets "jsx": "preserve" for Next's own compiler; Vite's
  // built-in transform needs an explicit mode or it inherits "preserve" and
  // fails to strip JSX in .tsx test/source files.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts", "components/**/*.test.tsx", "lib/**/*.test.ts"],
    coverage: {
      reporter: ["text", "json-summary"],
    },
  },
})
