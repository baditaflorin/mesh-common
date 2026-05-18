// Motion gated; arm both peers and dwell.
import { tryName, armConnect, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await armConnect(a);
  await armConnect(b);
  await wait(a, 12000);
}
