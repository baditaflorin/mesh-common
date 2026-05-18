// Both peers add a few names to the roster, then alice pairs the week.
import { armConnect, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armConnect(a);
  await armConnect(b);
  await wait(a, 400);

  for (const n of ["alice", "carlos", "dana"]) {
    await fillFirst(a, [/^name$|add a name|person/i], n);
    await clickByText(a, /^add$|^\+$|enter/i);
    await a.waitForTimeout(300);
  }
  for (const n of ["bob", "emi", "felix"]) {
    await fillFirst(b, [/^name$|add a name|person/i], n);
    await clickByText(b, /^add$|^\+$|enter/i);
    await b.waitForTimeout(300);
  }
  await wait(a, 800);

  await clickByText(a, /pair this week|pair|shuffle|run/i);

  await wait(a, 4000);
}
