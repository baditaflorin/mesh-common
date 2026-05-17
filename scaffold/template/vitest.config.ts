import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // file:../mesh-common can resolve React from its own node_modules,
    // creating duplicate instances and "useState of null" errors when
    // mesh-common hooks (PersonalQR, useQRScanner) are rendered in unit tests.
    dedupe: ["react", "react-dom", "yjs", "y-webrtc"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
});
