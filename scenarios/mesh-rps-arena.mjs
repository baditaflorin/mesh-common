// QR-mediated match; show names and dwell.
import { tryName, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 12000);
}
