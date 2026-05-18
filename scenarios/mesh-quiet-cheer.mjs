// Both name themselves; each picks the other as target; emoji cheers fly.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 700);

  // Tap a target chip first (the other's name) then emoji repeatedly
  await clickByText(a, /^bob$/i);
  await tapMany(a, '[aria-label*="cheer"], button:has-text("🎉"), button:has-text("⭐"), button:has-text("🙌")', 4, 250);
  await wait(a, 800);

  await clickByText(b, /^alice$/i);
  await tapMany(b, '[aria-label*="cheer"], button:has-text("🎉"), button:has-text("⭐"), button:has-text("🙌")', 4, 250);

  await wait(a, 4500);
}
