import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Long-running room leak detector. Boots two peers, runs the generic
 * "do something repeatedly" loop for ~60s, then asserts heap growth is
 * below the budget. Catches the classic "I forgot to off() an observer
 * in useEffect cleanup" pattern.
 *
 * Tunables:
 *   MESH_LEAK_DURATION_MS=60000   how long to run the noise loop
 *   MESH_LEAK_BUDGET_MB=15        max permitted JS heap growth
 *   MESH_LEAK_NOISE_OPS=200       how many ops per peer over the duration
 *
 * Why this is in the *template* and not invoked by default in every smoke
 * run: it's slow (~60s). Wire it into your app's pre-push only if it has a
 * persistent-room flavor (mesh-bench-archive, mesh-attendance, mesh-petition).
 *
 *   npm run test:leak    # add this script to package.json:
 *                        # "test:leak": "playwright test tests/e2e/memory-leak.spec.ts"
 */

const DURATION = Number(process.env.MESH_LEAK_DURATION_MS ?? 60_000);
const BUDGET_MB = Number(process.env.MESH_LEAK_BUDGET_MB ?? 15);
const NOISE_OPS = Number(process.env.MESH_LEAK_NOISE_OPS ?? 200);
const ENABLED = process.env.MESH_RUN_LEAK_TEST === "1";
const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const APP_NAME = pkg.name;

async function closeInitiallyOpenSettings(page: Page): Promise<void> {
  const settings = page.getByRole("dialog", { name: "Settings" });
  if (!(await settings.isVisible().catch(() => false))) return;
  const close = settings.getByRole("button", { name: "close" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(settings).toBeHidden();
}

test("memory leak — heap growth stays under budget over a long-running room", async ({
  browser,
}) => {
  // Keep the expensive detector opt-in. It is deliberately installed with
  // `test:e2e`, but only `npm run test:leak` enables its 60-second run.
  test.skip(!ENABLED, "run with `npm run test:leak`");
  test.setTimeout(Math.max(30_000, DURATION + 15_000));
  const ctx = await browser.newContext();
  await ctx.addInitScript(
    ({ prefix, room }) => {
      try {
        localStorage.setItem(prefix + ":room", room);
      } catch {
        /* private mode */
      }
    },
    { prefix: APP_NAME, room: `leak-${Date.now()}` },
  );

  const a = await ctx.newPage();
  const b = await ctx.newPage();
  await Promise.all([
    a.goto(`/${APP_NAME}/`, { waitUntil: "domcontentloaded" }),
    b.goto(`/${APP_NAME}/`, { waitUntil: "domcontentloaded" }),
  ]);
  // Make the noise loop exercise the app surface, not a first-visit Settings
  // overlay which intentionally intercepts background pointer events.
  await Promise.all([closeInitiallyOpenSettings(a), closeInitiallyOpenSettings(b)]);

  // Settle the initial mount + first GC opportunity.
  await a.waitForTimeout(1500);
  const before = await measureHeap(a);

  // Noise loop: click any visible button on both peers, sleep, repeat.
  // The point is to provoke observer churn — exact action doesn't matter.
  const interval = Math.max(50, Math.floor(DURATION / NOISE_OPS));
  const deadline = Date.now() + DURATION;
  while (Date.now() < deadline) {
    await Promise.all([clickAnything(a), clickAnything(b)]);
    await a.waitForTimeout(interval);
  }
  await a.waitForTimeout(1000);

  const after = await measureHeap(a);
  const grewMB = (after - before) / (1024 * 1024);
  console.log(
    `[mem-leak] before=${(before / 1e6).toFixed(1)}MB after=${(after / 1e6).toFixed(1)}MB grew=${grewMB.toFixed(2)}MB (budget=${BUDGET_MB}MB)`,
  );

  expect(grewMB, `JS heap grew beyond budget (${BUDGET_MB}MB)`).toBeLessThanOrEqual(BUDGET_MB);

  await ctx.close();
});

async function measureHeap(page: import("@playwright/test").Page): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  // Two GCs in a row stabilize the measurement (one to mark, one to sweep).
  await cdp.send("HeapProfiler.collectGarbage");
  await page.waitForTimeout(100);
  await cdp.send("HeapProfiler.collectGarbage");
  await page.waitForTimeout(100);
  // performance.memory is Chromium-specific. Playwright runs Chromium.
  return page.evaluate(
    () =>
      (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
        ?.usedJSHeapSize ?? 0,
  );
}

async function clickAnything(page: import("@playwright/test").Page): Promise<void> {
  const btn = page.locator("button:not([disabled]):not([aria-disabled='true']):visible").first();
  if ((await btn.count()) === 0) return;
  // Dispatch directly instead of using Playwright's actionability wait. The
  // probe needs to exercise the application's handler, not assert that every
  // stateful control remains actionable while two peers churn concurrently.
  // This keeps a short accelerated leak gate bounded for controls that
  // intentionally disappear or rerender after their first click.
  await btn
    .evaluate((element: HTMLButtonElement) => element.click(), undefined, { timeout: 500 })
    .catch(() => undefined);
}
