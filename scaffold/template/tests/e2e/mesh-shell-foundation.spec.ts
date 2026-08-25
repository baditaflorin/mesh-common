import { expect, test } from "@playwright/test";

const CONTRACT_STATES = new Set(["loading", "joining", "connected", "offline", "error"]);

const GSTATIC_CONNECTIVITY_PROBE = /^https?:\/\/www\.gstatic\.com\/generate_204(?:[/?#]|$)/i;

/**
 * Fleet UX-foundation contract.
 *
 * This remains deliberately feature-agnostic so it can ship with every
 * scaffolded app. It checks observable MeshShell behavior rather than merely
 * importing a primitive: the mounted shell, semantic theme tokens, accessible
 * settings, and the honest distinction between a shell that owns a room and
 * one whose feature owns its own transport.
 */
test("MeshShell provides the UX foundation without a third-party network probe", async ({
  page,
}) => {
  const gstaticRequests: string[] = [];
  page.on("request", (request) => {
    if (GSTATIC_CONNECTIVITY_PROBE.test(request.url())) {
      gstaticRequests.push(request.url());
    }
  });

  await page.goto("./", { waitUntil: "domcontentloaded" });

  const shell = page.locator("[data-mesh-app-shell]").first();
  await expect(shell).toBeVisible();

  await expect(page.locator("html")).toHaveAttribute("data-mesh-theme", /^(light|dark)$/);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.getPropertyValue("--mesh-accent").trim()),
    )
    .toMatch(/^#[\da-f]{3,8}$/i);

  const settings = page.getByRole("dialog", { name: "Settings" });
  if (!(await settings.isVisible())) {
    await page.getByRole("button", { name: "Open settings" }).click();
  }
  await expect(settings).toBeVisible();

  const roomState = await shell.getAttribute("data-mesh-room-state");
  if (roomState === null) {
    // A feature-owned transport must not receive a fabricated room state or
    // diagnostics for a second, unrelated connection.
    await expect(settings.locator('[aria-label="Connection diagnostics"]')).toHaveCount(0);
    await expect(settings.getByText("Connection details", { exact: true })).toHaveCount(0);
  } else {
    expect(CONTRACT_STATES.has(roomState)).toBe(true);
    await expect(settings.locator('[aria-label="Connection diagnostics"]')).toBeVisible();
    await expect(settings.getByText("Connection details", { exact: true })).toBeVisible();
  }

  // Let mount effects settle. A shared shell is intentionally passive: it may
  // observe browser online/offline events, but must not contact gstatic merely
  // because the app opened.
  await page.waitForTimeout(250);
  expect(gstaticRequests).toEqual([]);
});
