// A starts as "it"; QR-mediated tagging can't be simulated, dwell on banner.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 500);

  await clickByText(a, /start|i'?m it|^it$/i);
  await wait(a, 12000);
}
