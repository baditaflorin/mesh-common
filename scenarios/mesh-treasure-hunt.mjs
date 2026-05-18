// A configures step count; QR scanning is camera-bound so we dwell.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 500);

  // Try to set the step count + configure
  const numIn = a.locator('input[type="number"]').first();
  await numIn.fill("5", { timeout: 700 }).catch(() => {});
  await clickByText(a, /configure|^set$|^start$/i);

  await wait(a, 11000);
}
