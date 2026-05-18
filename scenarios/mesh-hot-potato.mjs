// Both join. A starts. Whoever holds it flings repeatedly.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /^start$|begin|new game/i);
  await wait(a, 800);

  // Fling on whichever side holds the potato — clicking on both is harmless
  await tapMany(a, 'button:has-text("FLING"), button:has-text("🥔"), [aria-label*="fling" i]', 2, 700);
  await tapMany(b, 'button:has-text("FLING"), button:has-text("🥔"), [aria-label*="fling" i]', 2, 700);
  await wait(a, 800);
  await tapMany(a, 'button:has-text("FLING"), button:has-text("🥔"), [aria-label*="fling" i]', 2, 700);
  await tapMany(b, 'button:has-text("FLING"), button:has-text("🥔"), [aria-label*="fling" i]', 2, 700);

  await wait(a, 3500);
}
