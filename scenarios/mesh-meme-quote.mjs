// Both submit quotes, then both vote on the matchup.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await fillFirst(a, [/your quote|quote/i], "Premature optimization is the root of all evil.");
  await clickByText(a, /submit quote|^submit$|^add$/i);
  await wait(a, 600);

  await fillFirst(b, [/your quote|quote/i], "There are only two hard things in CS: cache invalidation and naming things.");
  await clickByText(b, /submit quote|^submit$|^add$/i);
  await wait(a, 1500);

  // Both vote (A picks A side, B picks B side)
  await clickByText(a, /vote a|^a$/i);
  await clickByText(b, /vote b|^b$/i);

  await wait(a, 3500);
}
