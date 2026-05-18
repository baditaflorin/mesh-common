// Both write takes, A starts the blitz, both react.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  const ta = a.locator('textarea').first();
  const tb = b.locator('textarea').first();
  await ta.fill("Salt > sugar in coffee. Try it.", { timeout: 700 }).catch(() => {});
  await clickByText(a, /^add$|submit|drop/i);
  await wait(a, 500);
  await tb.fill("Pull requests should expire after 48h.", { timeout: 700 }).catch(() => {});
  await clickByText(b, /^add$|submit|drop/i);
  await wait(a, 700);

  await clickByText(a, /^start$|begin blitz|go/i);
  await wait(a, 1500);

  // React to current take with rockets
  await tapMany(a, 'button:has-text("🚀"), [aria-label*="rocket" i]', 2, 350);
  await tapMany(b, 'button:has-text("🤔"), [aria-label*="think" i]', 1, 350);
  await wait(a, 2500);
  await tapMany(a, 'button:has-text("🗑"), button:has-text("👎"), [aria-label*="trash" i]', 1, 350);
  await tapMany(b, 'button:has-text("🚀"), [aria-label*="rocket" i]', 2, 350);

  await wait(a, 2500);
}
