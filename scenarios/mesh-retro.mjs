// Camera + AprilTag gated; arm and dwell on the board.
import { armConnect, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armConnect(a);
  await armConnect(b);
  await wait(a, 12000);
}
