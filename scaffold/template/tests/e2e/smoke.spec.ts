import { expect, test } from "@playwright/test";
import { captureConsoleErrors } from "@baditaflorin/mesh-common/testing";

/**
 * Generic smoke test — works for any mesh-* app without modification.
 * Asserts: page loads, settings drawer opens, self-ref bar visible, no
 * console errors.
 */

test("page loads with version + source + tip visible", async ({ page }) => {
  const c = captureConsoleErrors(page);
  await page.goto("./");

  // Self-ref bar contains a "source" link, a "tip" link, and a version stamp.
  await expect(page.getByRole("link", { name: /source/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /tip/i }).first()).toBeVisible();
  await expect(page.locator(".mesh-self-ref").getByText(/^v\d/)).toBeVisible();

  // Allow a moment for async TURN fetch / WebRTC handshake; benign warnings
  // about TURN unreachable are OK, but real errors are not.
  await page.waitForTimeout(800);
  const errors = c.getErrors().filter((e) => {
    // Ignore network failures that come from the intentionally-unreachable
    // signaling URL in the test environment.
    return !/turn|stun|signaling|websocket|webrtc|failed to load resource|err_failed|err_connection|err_blocked|err_name_not_resolved/i.test(
      e,
    );
  });
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("settings drawer opens and shows infra fields", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Open settings").click();
  await expect(page.getByText(/Self-hosted infra/i)).toBeVisible();
  await expect(page.getByText(/Signaling URL/i)).toBeVisible();
  await expect(page.getByText(/TURN credentials URL/i)).toBeVisible();
});
