import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node by default. A test that needs DOM globals declares it per file with
    // a `// @vitest-environment jsdom` docblock on its first line (Vitest 4
    // removed `environmentMatchGlobs`).
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    // The 5 s default times out a few slow render/subprocess tests on a
    // loaded CI host; they pass in well under a second when run alone.
    testTimeout: 15_000,
  },
});
