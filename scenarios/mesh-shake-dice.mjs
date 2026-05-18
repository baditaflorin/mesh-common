// Both arm; alternate rolls so the history grows.
import { tryName, armConnect, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await armConnect(a);
  await armConnect(b);
  await wait(a, 600);

  await tapMany(a, 'button:has-text("ROLL"), button:has-text("🎲"), [aria-label*="roll" i]', 1, 0);
  await wait(a, 1500);
  await tapMany(b, 'button:has-text("ROLL"), button:has-text("🎲"), [aria-label*="roll" i]', 1, 0);
  await wait(a, 1500);

  // Switch dice shape on A, roll again
  await clickByText(a, /^d20$|^d6$|3d6/i);
  await wait(a, 600);
  await tapMany(a, 'button:has-text("ROLL"), button:has-text("🎲"), [aria-label*="roll" i]', 1, 0);
  await wait(a, 1500);
  await tapMany(b, 'button:has-text("ROLL"), button:has-text("🎲"), [aria-label*="roll" i]', 1, 0);

  await wait(a, 3000);
}
