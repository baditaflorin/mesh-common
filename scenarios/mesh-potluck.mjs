// Both peers add dishes; one is a duplicate to surface the warn badge.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  for (const dish of ["sourdough loaf", "halloumi salad"]) {
    await fillFirst(a, [/i'?ll bring|dish|item/i], dish);
    await clickByText(a, /^add$|^\+$|enter/i);
    await a.waitForTimeout(400);
  }
  for (const dish of ["sourdough loaf", "miso soup"]) {
    await fillFirst(b, [/i'?ll bring|dish|item/i], dish);
    await clickByText(b, /^add$|^\+$|enter/i);
    await b.waitForTimeout(400);
  }
  await wait(a, 1500);

  // One more on each
  await fillFirst(a, [/i'?ll bring|dish|item/i], "tarragon meringues");
  await clickByText(a, /^add$|^\+$|enter/i);

  await wait(a, 3500);
}
