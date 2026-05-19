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
      // batch-2 (2026-05-19)
      ["tests/useThreadedMessages.test.tsx", "jsdom"],
      ["tests/useReadReceipts.test.tsx", "jsdom"],
      ["tests/useChangelogToast.test.tsx", "jsdom"],
      ["tests/useOfflineQueue.test.tsx", "jsdom"],
      ["tests/useFileShare.test.tsx", "jsdom"],
      ["tests/useNetworkOnline.test.tsx", "jsdom"],
      ["tests/SafeMarkdown.test.tsx", "jsdom"],
      // fleet identity (2026-05-19)
      ["tests/fleetPersona.test.ts", "jsdom"],
      ["tests/useFleetPersona.test.tsx", "jsdom"],
      ["tests/configBridge.test.ts", "jsdom"],
    ],
  },
});
