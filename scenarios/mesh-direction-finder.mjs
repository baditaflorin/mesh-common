// Compass-permission gated — arm both, dwell on the UI affordance.
import { armConnect, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armConnect(a);
  await armConnect(b);
  await wait(a, 11000);
}
