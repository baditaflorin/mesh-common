// Both paint different time slots in the grid.
import { tryName, wait } from "./_helpers.mjs";

const paintCells = async (page, indices) => {
  const cells = page.locator('button:visible');
  const n = await cells.count();
  for (const i of indices) {
    if (i < n) {
      try { await cells.nth(i).click({ timeout: 500, force: true }); } catch {}
      await page.waitForTimeout(60);
    }
  }
};

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 400);

  // Pick scattered grid cells; both peers paint different ranges
  await paintCells(a, Array.from({ length: 8 }, (_, i) => 12 + i));
  await wait(a, 800);
  await paintCells(b, Array.from({ length: 8 }, (_, i) => 14 + i));
  await wait(a, 1500);
  await paintCells(a, Array.from({ length: 6 }, (_, i) => 30 + i));

  await wait(a, 4500);
}
