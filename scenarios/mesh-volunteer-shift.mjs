// A creates a couple of shift slots; B claims one.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 400);

  // Create a shift on A
  await fillFirst(a, [/date/i], "2026-06-12");
  await fillFirst(a, [/^time$|when|start/i], "09:00");
  await clickByText(a, /add shift|^add$|^\+$|create/i);
  await wait(a, 1500);

  // Another shift
  await fillFirst(a, [/date/i], "2026-06-13");
  await fillFirst(a, [/^time$|when|start/i], "14:00");
  await clickByText(a, /add shift|^add$|^\+$|create/i);
  await wait(a, 1500);

  // B claims the first one
  await clickByText(b, /^claim$|sign up|join shift|^\+ claim$/i);

  await wait(a, 3500);
}
