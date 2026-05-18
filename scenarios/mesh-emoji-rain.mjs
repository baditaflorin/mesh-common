// Each peer taps a sequence of emojis. The rain falls visibly on both phones,
// and the per-emoji count + peer count update.
import { tryName, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  // Find all emoji buttons in the rain grid (aria-label="rain X")
  const tapEmojis = async (page, indices, gap = 150) => {
    const btns = page.locator('button[aria-label^="rain"], [role="group"] button, .emoji-btn, button:visible');
    const n = await btns.count();
    for (const i of indices) {
      if (i < n) {
        try { await btns.nth(i).click({ timeout: 800, force: true }); } catch {}
        await page.waitForTimeout(gap);
      }
    }
  };

  // alice taps 4 different emojis quickly
  await tapEmojis(a, [0, 1, 2, 3], 250);
  // bob taps a different set, interleaved
  await tapEmojis(b, [4, 5, 6, 0], 250);
  // alice fires a celebration burst on the same emoji
  await tapEmojis(a, [0, 0, 0, 1, 1], 180);
  // bob fires back
  await tapEmojis(b, [7, 7, 2, 2], 200);

  // Let the fall animation finish + counters settle
  await wait(a, 3000);
}
