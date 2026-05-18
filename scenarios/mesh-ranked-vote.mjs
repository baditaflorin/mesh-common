// A sets the question; both add options + rank them.
import { tryName, fillFirst, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /tap to set a question|set a question|edit/i);
  await fillFirst(a, [/question/i], "Office snack to restock first?");
  await clickByText(a, /^save$|done/i);
  await wait(a, 600);

  for (const opt of ["dark chocolate almonds", "kombucha six-pack", "trail mix"]) {
    await fillFirst(a, [/add option|option/i], opt);
    await clickByText(a, /^add$|^\+$/i);
    await a.waitForTimeout(300);
  }
  await wait(a, 800);

  // Both rank options by clicking "+" buttons (default position)
  await tapMany(a, 'button:has-text("+"), [aria-label*="rank" i]', 3, 250);
  await tapMany(b, 'button:has-text("+"), [aria-label*="rank" i]', 3, 250);

  await wait(a, 3500);
}
