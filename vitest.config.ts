import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // securityAudit needs DOM globals for @testing-library/react renderHook
    environmentMatchGlobs: [
      ["tests/securityAudit.test.ts", "jsdom"],
      ["tests/primitives.test.ts", "jsdom"],
    ],
  },
});
