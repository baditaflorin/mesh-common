// Both join; A starts; both fire ROAST/TOAST while one is in the hot seat.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /^start$|begin/i);
  await wait(a, 800);

  // Both peers tap reactions while turns rotate
  await tapMany(a, 'button:has-text("🔥"), [aria-label*="roast" i], button:has-text("ROAST")', 3, 350);
  await wait(a, 600);
  await tapMany(b, 'button:has-text("🌹"), [aria-label*="toast" i], button:has-text("TOAST")', 3, 350);
  await wait(a, 600);
  await tapMany(a, 'button:has-text("🌹"), [aria-label*="toast" i], button:has-text("TOAST")', 2, 350);
  await tapMany(b, 'button:has-text("🔥"), [aria-label*="roast" i], button:has-text("ROAST")', 2, 350);

  await wait(a, 4000);
}
