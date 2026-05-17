import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

/**
 * Generic mesh-presence test — works for any mesh-* app without modification.
 * Opens two pages in the same browser context so y-webrtc's BroadcastChannel
 * fallback syncs them with no signaling server / no network.
 *
 * Apps that show a peer count in the UI should pass this. Apps that don't
 * surface peer count can override or skip this test.
 */
test("two peers in the same room can both load", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await expect(a.locator(".mesh-self-ref, .self-ref").first()).toBeVisible();
    await expect(b.locator(".mesh-self-ref, .self-ref").first()).toBeVisible();
    // Both should reach a non-loading state within the timeout — most apps
    // either show a count, a heading, or a primary control. We assert that
    // at least one <h1> is present on both pages.
    await expect(a.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(b.getByRole("heading", { level: 1 }).first()).toBeVisible();
  } finally {
    await cleanup();
  }
});
