// Both join. Each drops a pitch; the other reacts.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /^start$|begin/i);
  await wait(a, 1000);

  const ta1 = a.locator('textarea').first();
  await ta1.fill("Mesh-clock-synced board games for in-person nights.", { timeout: 800 }).catch(() => {});
  await clickByText(a, /drop pitch|^drop$|submit/i);
  await wait(a, 1500);

  // B reacts with 🚀 + 🤔
  await tapMany(b, 'button:has-text("🚀"), [aria-label*="rocket" i]', 2, 300);
  await tapMany(b, 'button:has-text("🤔"), [aria-label*="think" i]', 1, 300);
  await wait(a, 1200);

  // B's turn
  const ta2 = b.locator('textarea').first();
  await ta2.fill("Audio-only mesh karaoke for shy crowds.", { timeout: 700 }).catch(() => {});
  await clickByText(b, /drop pitch|^drop$|submit/i);
  await wait(a, 800);
  await tapMany(a, 'button:has-text("🚀"), [aria-label*="rocket" i]', 1, 300);

  await wait(a, 3500);
}
