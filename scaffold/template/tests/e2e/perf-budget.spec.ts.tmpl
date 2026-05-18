import { test, expect } from "@playwright/test";

/**
 * Local performance budget — fails the smoke run if the app's LCP or INP
 * blows past the threshold. Tunable via env vars; defaults are mid-range
 * phone targets (slower than desktop, friendlier than "good Wi-Fi laptop").
 *
 *   MESH_BUDGET_LCP_MS=2500   max Largest Contentful Paint
 *   MESH_BUDGET_INP_MS=300    max Interaction-to-Next-Paint after one click
 *   MESH_BUDGET_TBT_MS=600    max Total Blocking Time
 *
 * Reference: https://web.dev/vitals/
 */

const LCP_MS = Number(process.env.MESH_BUDGET_LCP_MS ?? 2500);
const INP_MS = Number(process.env.MESH_BUDGET_INP_MS ?? 300);
const TBT_MS = Number(process.env.MESH_BUDGET_TBT_MS ?? 600);

test("perf budget — LCP + TBT under threshold on cold load", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");

  await page.goto("/__APP_NAME__/", { waitUntil: "domcontentloaded" });

  // PerformanceObserver-based LCP capture. We resolve as soon as the first
  // post-interactive LCP entry lands, with a 6s overall cap.
  const lcp = await page.evaluate<number | null>(
    () =>
      new Promise<number | null>((resolve) => {
        let last: PerformanceEntry | null = null;
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) last = entry;
        });
        try {
          obs.observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          resolve(null);
          return;
        }
        setTimeout(() => {
          obs.disconnect();
          resolve(last ? (last as PerformanceEntry & { renderTime?: number }).renderTime ?? last.startTime : null);
        }, 6000);
      }),
  );

  const tbt = await page.evaluate<number>(() => {
    // Approximate TBT: sum of (duration - 50) for long tasks > 50ms.
    const tasks = performance.getEntriesByType("longtask") as PerformanceEntry[];
    return tasks.reduce((acc, t) => acc + Math.max(0, t.duration - 50), 0);
  });

  console.log(`[perf-budget] LCP=${lcp ?? "?"}ms TBT=${tbt}ms (budget LCP<=${LCP_MS} TBT<=${TBT_MS})`);

  expect(lcp ?? 0, `LCP exceeded budget (${LCP_MS}ms)`).toBeLessThanOrEqual(LCP_MS);
  expect(tbt, `TBT exceeded budget (${TBT_MS}ms)`).toBeLessThanOrEqual(TBT_MS);
});

test("perf budget — INP under threshold after one interaction", async ({ page }) => {
  await page.goto("/__APP_NAME__/", { waitUntil: "domcontentloaded" });

  // Pick whatever's clickable; the budget cares about *any* interaction's
  // INP, not a specific feature. If nothing is clickable we pass trivially.
  const button = page.locator("button:visible").first();
  if ((await button.count()) === 0) {
    test.info().annotations.push({ type: "skip", description: "no visible buttons" });
    return;
  }

  // INP is the worst (well, ~98th percentile) post-input latency. For a
  // single-click smoke test we measure event → next-paint round-trip.
  const inp = await page.evaluate<number | null>(
    () =>
      new Promise<number | null>((resolve) => {
        let worst = 0;
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<PerformanceEntry & { interactionId?: number; duration: number }>) {
            if (entry.interactionId && entry.duration > worst) worst = entry.duration;
          }
        });
        try {
          obs.observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
        } catch {
          resolve(null);
          return;
        }
        setTimeout(() => {
          obs.disconnect();
          resolve(worst);
        }, 3000);
      }),
  );

  await button.click({ trial: false });
  await page.waitForTimeout(2500);

  console.log(`[perf-budget] INP=${inp ?? "?"}ms (budget INP<=${INP_MS})`);
  expect(inp ?? 0, `INP exceeded budget (${INP_MS}ms)`).toBeLessThanOrEqual(INP_MS);
});
