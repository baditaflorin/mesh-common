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
      ["tests/security.test.ts", "jsdom"],
      ["tests/multiplayer.test.ts", "jsdom"],
      ["tests/useAwareness.test.ts", "jsdom"],
      ["tests/PeerAvatar.test.tsx", "jsdom"],
      ["tests/useMultiRoom.test.tsx", "jsdom"],
      ["tests/featureContract.test.ts", "jsdom"],
    ],
  },
});
