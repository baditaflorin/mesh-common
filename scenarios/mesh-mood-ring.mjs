// Both name themselves and drag the hue slider — backgrounds shift.
import { tryName, setRange, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 400);

  await setRange(a, 0.15); // ~55° (warm)
  await setRange(b, 0.55); // ~200° (teal)
  await wait(a, 3000);

  await setRange(a, 0.75); // ~270° (violet)
  await setRange(b, 0.30); // ~110° (green)
  await wait(a, 3500);

  await setRange(a, 0.95);
  await setRange(b, 0.0);
  await wait(a, 3000);
}
