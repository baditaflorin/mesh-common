// Both contribute amounts; the thermometer climbs.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  for (const amt of ["25", "50"]) {
    await fillFirst(a, [/amount|\$|number/i], amt);
    await clickByText(a, /^add$|^\+|contribute|donate/i);
    await a.waitForTimeout(400);
  }
  for (const amt of ["40", "75"]) {
    await fillFirst(b, [/amount|\$|number/i], amt);
    await clickByText(b, /^add$|^\+|contribute|donate/i);
    await b.waitForTimeout(400);
  }
  await wait(a, 1500);

  // One more on each to fill the bar
  await fillFirst(a, [/amount|\$|number/i], "120");
  await clickByText(a, /^add$|^\+|contribute|donate/i);

  await wait(a, 3500);
}
