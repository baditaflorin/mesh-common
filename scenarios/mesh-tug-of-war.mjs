// A joins red, B joins blue; A starts; both spam the tap button.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /^red$|join red/i);
  await clickByText(b, /^blue$|join blue/i);
  await wait(a, 500);

  await clickByText(a, /^start$|begin|go/i);
  await wait(a, 600);

  // Both spam taps; A pulls harder
  await tapMany(a, 'button:has-text("TAP"), button:has-text("PULL"), [aria-label*="tap" i]', 10, 120);
  await tapMany(b, 'button:has-text("TAP"), button:has-text("PULL"), [aria-label*="tap" i]', 7, 160);
  await wait(a, 600);
  await tapMany(a, 'button:has-text("TAP"), button:has-text("PULL"), [aria-label*="tap" i]', 8, 120);

  await wait(a, 3000);
}
