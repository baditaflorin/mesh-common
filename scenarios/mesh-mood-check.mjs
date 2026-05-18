// Both connect, tap mood faces.
import { armBoth, clickNthButtons, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armBoth(a, b);
  await wait(a, 600);

  // Tap different mood emoji buttons on each peer
  await clickNthButtons(a, [3]); // "good"
  await wait(a, 1500);
  await clickNthButtons(b, [1]); // "rough"
  await wait(a, 2500);

  // Both swap moods
  await clickNthButtons(a, [4]);
  await clickNthButtons(b, [3]);

  await wait(a, 4000);
}
