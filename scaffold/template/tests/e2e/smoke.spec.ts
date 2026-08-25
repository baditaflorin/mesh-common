import { expect, test, type Locator, type Page } from "@playwright/test";
import { captureConsoleErrors } from "@baditaflorin/mesh-common/testing";

function settingsDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Settings" });
}

function legacySettingsDrawer(page: Page): Locator {
  return page.locator(".mesh-settings-drawer, .settings-drawer").first();
}

async function isVisible(locator: Locator): Promise<boolean> {
  return locator.isVisible().catch(() => false);
}

/**
 * First-visit flows may intentionally open the accessible Settings sheet.
 * Radix correctly makes the background inaccessible while it is open, so
 * content-level assertions must close it first rather than mistake that for
 * a missing page. This remains scoped to the test; the app owns onboarding.
 */
async function closeInitiallyOpenSettings(page: Page): Promise<void> {
  const dialog = settingsDialog(page);
  if (!(await isVisible(dialog))) return;
  const close = dialog.getByRole("button", { name: "close" });
  if (await isVisible(close)) {
    await close.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(dialog).toBeHidden();
}

async function openSettings(page: Page): Promise<Locator> {
  const dialog = settingsDialog(page);
  if (await isVisible(dialog)) return dialog;

  const legacyDrawer = legacySettingsDrawer(page);
  if (await isVisible(legacyDrawer)) return legacyDrawer;

  await page.getByLabel("Open settings").click();
  if (await isVisible(dialog)) return dialog;
  await expect(legacyDrawer).toBeVisible();
  return legacyDrawer;
}

/**
 * Generic smoke test — works for any mesh-* app without modification.
 * Asserts: page loads, Settings → About exposes product metadata, and no
 * console errors occur. Source/support/version moved out of the permanent
 * viewport chrome so a polished app can keep its first view product-focused.
 */

test("page loads with product metadata available in Settings", async ({ page }) => {
  const c = captureConsoleErrors(page);
  await page.goto("./");
  await closeInitiallyOpenSettings(page);

  const drawer = await openSettings(page);
  await expect(drawer.getByRole("link", { name: /^source$/i })).toBeVisible();
  await expect(drawer.getByRole("link", { name: /^support$/i })).toBeVisible();
  await expect(drawer.getByText(/^v\d/).first()).toBeVisible();

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

test("settings drawer can be opened (or is already open) and shows infra fields", async ({
  page,
}) => {
  await page.goto("./");
  // Settings is an accessible Radix dialog in the current shell. Keep the
  // legacy drawer fallback for older app bundles that are refreshed in place.
  const drawer = await openSettings(page);
  await expect(drawer.getByText(/Self-hosted infra/i)).toBeVisible();
  await expect(drawer.getByText(/Signaling URL/i)).toBeVisible();
  await expect(drawer.getByText(/TURN credentials URL/i)).toBeVisible();
});
