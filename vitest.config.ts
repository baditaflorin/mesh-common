import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // securityAudit + primitives + ui need DOM globals for testing-library
    environmentMatchGlobs: [
      ["tests/securityAudit.test.ts", "jsdom"],
      ["tests/primitives.test.ts", "jsdom"],
      ["tests/ui.test.tsx", "jsdom"],
    ],
  },
});
