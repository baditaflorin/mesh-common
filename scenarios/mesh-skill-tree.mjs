// Both connect; each rates a handful of skills.
import { armBoth, clickNthButtons, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armBoth(a, b);
  await wait(a, 800);

  // Pick scattered rating buttons (1..4 cells per skill)
  await clickNthButtons(a, [2, 5, 8, 11, 14]);
  await wait(a, 1500);
  await clickNthButtons(b, [3, 6, 9, 12, 15]);
  await wait(a, 2000);
  // Update some ratings
  await clickNthButtons(a, [4, 10]);
  await clickNthButtons(b, [5, 11]);

  await wait(a, 3500);
}
