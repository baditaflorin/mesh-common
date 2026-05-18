// Both peers join; one claims the baton, taps "+ 1 step" a few times.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await clickByText(a, /claim baton|claim|take/i);
  await wait(a, 600);

  await tapMany(a, 'button:has-text("+ 1"), button:has-text("step"), [aria-label*="step" i]', 6, 400);
  await wait(a, 800);

  // B claims and adds
  await clickByText(b, /claim baton|claim|take/i);
  await tapMany(b, 'button:has-text("+ 1"), button:has-text("step"), [aria-label*="step" i]', 4, 400);

  await wait(a, 3000);
}
