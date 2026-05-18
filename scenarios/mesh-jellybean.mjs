// Sealed-bid estimate: both peers connect, type guesses, lock in, then reveal.
import { armBoth, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armBoth(a, b);
  await wait(a, 600);

  // Each peer types its guess in the (numeric) input
  const inA = a.locator('input[type="number"], input[type="text"]:not([placeholder*="name" i])').first();
  const inB = b.locator('input[type="number"], input[type="text"]:not([placeholder*="name" i])').first();
  await inA.fill("412", { timeout: 800 }).catch(() => {});
  await inB.fill("537", { timeout: 800 }).catch(() => {});
  await wait(a, 400);

  await clickByText(a, /lock in|^lock$|submit|seal/i);
  await clickByText(b, /lock in|^lock$|submit|seal/i);
  await wait(a, 1500);

  await clickByText(a, /move to reveal|reveal|next/i);
  await clickByText(b, /move to reveal|reveal|next/i);

  await wait(a, 3500);
}
