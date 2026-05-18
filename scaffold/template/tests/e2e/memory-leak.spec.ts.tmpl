import { test, expect } from "@playwright/test";

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

test("memory leak — heap growth stays under budget over a long-running room", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(
    ({ prefix, room }) => {
      try {
        localStorage.setItem(prefix + ":room", room);
      } catch {
        /* private mode */
      }
    },
    { prefix: "__APP_NAME__", room: `leak-${Date.now()}` },
  );

  const a = await ctx.newPage();
  const b = await ctx.newPage();
  await Promise.all([
    a.goto("/__APP_NAME__/", { waitUntil: "domcontentloaded" }),
    b.goto("/__APP_NAME__/", { waitUntil: "domcontentloaded" }),
  ]);

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
  console.log(`[mem-leak] before=${(before / 1e6).toFixed(1)}MB after=${(after / 1e6).toFixed(1)}MB grew=${grewMB.toFixed(2)}MB (budget=${BUDGET_MB}MB)`);

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
  return page.evaluate(() => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);
}

async function clickAnything(page: import("@playwright/test").Page): Promise<void> {
  const btn = page.locator("button:visible").first();
  if ((await btn.count()) === 0) return;
  await btn.click({ trial: false, timeout: 2000 }).catch(() => undefined);
}
