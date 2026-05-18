// Motion gated; arm both peers and dwell on the pose sequence.
import { armConnect, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armConnect(a);
  await armConnect(b);
  await wait(a, 12000);
}
