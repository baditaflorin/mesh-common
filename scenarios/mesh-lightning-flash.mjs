// A arms as camera, B arms as lamp. A fires FLASH a few times.
import { armConnect, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await armConnect(a);
  await armConnect(b);
  await wait(a, 800);

  await tapMany(a, 'button:has-text("FLASH"), button:has-text("⚡"), [aria-label*="flash" i]', 3, 1800);
  await wait(a, 3500);
}
