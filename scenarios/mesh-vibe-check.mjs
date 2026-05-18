// Both peers name themselves and drag a few sliders to different positions.
import { tryName, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 500);

  const setRanges = async (page, fractions) => {
    const ranges = page.locator('input[type="range"]');
    const n = Math.min(await ranges.count(), fractions.length);
    for (let i = 0; i < n; i++) {
      try {
        await ranges.nth(i).evaluate((el, f) => {
          const min = Number(el.min || 0);
          const max = Number(el.max || 100);
          el.value = String(min + (max - min) * f);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, fractions[i]);
        await page.waitForTimeout(180);
      } catch {}
    }
  };

  await setRanges(a, [0.75, 0.55, 0.35, 0.8, 0.15]);
  await wait(a, 1500);
  await setRanges(b, [0.35, 0.85, 0.7, 0.4, 0.55]);

  await wait(a, 4500);
}
