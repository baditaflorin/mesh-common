// Both peers connect; the bar pulses at the shared BPM via mesh-clock.
import { armConnect, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armConnect(a);
  await armConnect(b);
  await clickByText(a, /^start$/i);
  await wait(a, 12000);
}
