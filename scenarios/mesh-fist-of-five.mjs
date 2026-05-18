// Both connect. A votes 4, B votes 2 — bars diverge.
import { armBoth, clickNthButtons, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armBoth(a, b);
  await wait(a, 800);

  // The five vote cells appear as buttons; click the 4th on A, 2nd on B
  await clickNthButtons(a, [3]);
  await wait(a, 1500);
  await clickNthButtons(b, [1]);
  await wait(a, 2500);

  // Change minds
  await clickNthButtons(a, [4]);
  await wait(a, 1500);
  await clickNthButtons(b, [3]);

  await wait(a, 3500);
}
