// Both peers connect, tick "can carry" checkboxes for different topics so
// the aggregate coverage chart shows divergent bars.
import { armBoth, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armBoth(a, b);
  await wait(a, 800);

  // Alice ticks first two checkboxes (e.g. auth, deploy)
  const aBoxes = a.locator('input[type="checkbox"]:visible');
  const n1 = await aBoxes.count();
  for (const i of [0, 2]) {
    if (i < n1) await aBoxes.nth(i).check({ timeout: 700 }).catch(() => {});
    await a.waitForTimeout(200);
  }

  // Bob ticks complementary set
  const bBoxes = b.locator('input[type="checkbox"]:visible');
  const n2 = await bBoxes.count();
  for (const i of [1, 3]) {
    if (i < n2) await bBoxes.nth(i).check({ timeout: 700 }).catch(() => {});
    await b.waitForTimeout(200);
  }

  await wait(a, 4500);
}
