// Both drop a thought, each upvotes the other's.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  const ta = a.locator('textarea').first();
  const tb = b.locator('textarea').first();
  await ta.fill("All software is just two functions in a trenchcoat.", { timeout: 800 }).catch(() => {});
  await clickByText(a, /drop it|^drop$|^post$|submit/i);
  await wait(a, 800);

  await tb.fill("Your dependencies have dependencies, all the way down.", { timeout: 800 }).catch(() => {});
  await clickByText(b, /drop it|^drop$|^post$|submit/i);
  await wait(a, 1500);

  await tapMany(b, 'button:has-text("▲"), button:has-text("↑"), [aria-label*="up" i]', 1, 250);
  await tapMany(a, 'button:has-text("▲"), button:has-text("↑"), [aria-label*="up" i]', 1, 250);

  await ta.fill("CDNs are 90% optimism, 10% caching strategy.", { timeout: 600 }).catch(() => {});
  await clickByText(a, /drop it|^drop$|^post$|submit/i);

  await wait(a, 3500);
}
