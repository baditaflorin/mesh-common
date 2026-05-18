// Both arm; each taps the canvas to spawn ripples.
import { armConnect, wait } from "./_helpers.mjs";

const ripple = async (page, fx, fy) => {
  const canvas = page.locator("canvas").first();
  if ((await canvas.count()) === 0) return;
  const box = await canvas.boundingBox().catch(() => null);
  if (!box) return;
  try {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  } catch {}
};

export default async function (a, b) {
  await armConnect(a);
  await armConnect(b);
  await wait(a, 600);

  for (const [fx, fy] of [[0.3, 0.4], [0.7, 0.5], [0.5, 0.2], [0.4, 0.7]]) {
    await ripple(a, fx, fy);
    await a.waitForTimeout(700);
  }
  for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.6], [0.8, 0.3]]) {
    await ripple(b, fx, fy);
    await b.waitForTimeout(700);
  }

  await wait(a, 3500);
}
