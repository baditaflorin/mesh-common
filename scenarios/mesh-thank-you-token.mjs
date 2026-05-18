// QR-mediated; name + reason text are visible but scan can't be triggered.
import { tryName, fillFirst, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await fillFirst(a, [/reason|why|thank/i], "for the calm code review");
  await fillFirst(b, [/reason|why|thank/i], "for the late-night rubber-ducking");
  await wait(a, 11000);
}
