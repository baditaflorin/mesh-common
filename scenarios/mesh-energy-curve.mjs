// Both connect, slide energy values to disparate levels — curve diverges.
import { armBoth, setRange, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armBoth(a, b);
  await wait(a, 800);

  await setRange(a, 0.8);
  await setRange(b, 0.3);
  await wait(a, 2500);

  await setRange(a, 0.45);
  await setRange(b, 0.6);
  await wait(a, 2500);

  // B clicks "suggest break"
  await clickByText(b, /suggest a break|break/i);

  await wait(a, 3500);
}
