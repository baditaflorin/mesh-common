// Both peers add dares, then spin: commit → reveal → deterministic pick.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  for (const d of ["sing a sea shanty", "do 10 jumping jacks", "share an unpopular take"]) {
    await fillFirst(a, [/add a dare|dare/i], d);
    await clickByText(a, /^add$|^\+$/i);
    await a.waitForTimeout(250);
  }
  for (const d of ["call grandma", "compliment a stranger"]) {
    await fillFirst(b, [/add a dare|dare/i], d);
    await clickByText(b, /^add$|^\+$/i);
    await b.waitForTimeout(250);
  }
  await wait(a, 800);

  await clickByText(a, /SPIN THE WHEEL|spin|go/i);
  await wait(a, 2200);

  await clickByText(a, /all sealed|reveal|next/i);
  await clickByText(b, /all sealed|reveal|next/i);

  await wait(a, 3500);
}
