// Motion gated; arm + dwell. Test-tilt sliders may exist for debugging.
import { tryName, armConnect, setRange, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await armConnect(a);
  await armConnect(b);
  await wait(a, 1000);

  // If test sliders are visible, nudge them
  await setRange(a, 0.7);
  await setRange(b, 0.3);

  await wait(a, 10000);
}
