// Both name themselves, write a short message, pick the 1-sec duration, seal.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  const ta = a.locator('textarea').first();
  const tb = b.locator('textarea').first();
  await ta.fill("dear future-me — buy real espresso", { timeout: 800 }).catch(() => {});
  await tb.fill("hello 2027 self — did the rooftop garden survive?", { timeout: 800 }).catch(() => {});
  await wait(a, 500);

  // Pick 1-second duration so it unlocks before the recording ends
  await clickByText(a, /1 sec|1s|^1$/i);
  await clickByText(b, /1 sec|1s|^1$/i);
  await wait(a, 400);

  await clickByText(a, /^seal$|lock|submit/i);
  await clickByText(b, /^seal$|lock|submit/i);
  await wait(a, 2500);

  // Reveal
  await clickByText(a, /reveal mine|^reveal$/i);
  await clickByText(b, /reveal mine|^reveal$/i);

  await wait(a, 3500);
}
