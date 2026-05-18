// Both vote yes/no across a few prompts.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 500);

  // Alternate clicks
  await tapMany(a, 'button:has-text("yes"), [aria-label*="yes" i]', 1, 200);
  await tapMany(b, 'button:has-text("no"), [aria-label*="no" i]', 1, 200);
  await wait(a, 1500);

  // Custom prompt
  const ta = a.locator('textarea').first();
  await ta.fill("…paired with a stranger on a 24-hour flight delay", { timeout: 700 }).catch(() => {});
  await clickByText(a, /^add$|^post$|drop|submit/i);
  await wait(a, 1500);

  await tapMany(b, 'button:has-text("yes"), [aria-label*="yes" i]', 1, 200);
  await tapMany(a, 'button:has-text("no"), [aria-label*="no" i]', 1, 200);

  await wait(a, 3500);
}
