// Both queue songs and up/downvote each other's.
import { tryName, fillFirst, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await fillFirst(a, [/title/i], "Wonderwall");
  await fillFirst(a, [/artist/i], "Oasis");
  await clickByText(a, /queue it|^queue$|^add$|submit/i);
  await wait(a, 800);

  await fillFirst(b, [/title/i], "Take On Me");
  await fillFirst(b, [/artist/i], "a-ha");
  await clickByText(b, /queue it|^queue$|^add$|submit/i);
  await wait(a, 1500);

  // Both upvote each other
  await tapMany(a, 'button:has-text("▲"), button:has-text("↑"), [aria-label*="upvote" i]', 1, 250);
  await tapMany(b, 'button:has-text("▲"), button:has-text("↑"), [aria-label*="upvote" i]', 1, 250);

  // A queues another
  await fillFirst(a, [/title/i], "Mr. Blue Sky");
  await fillFirst(a, [/artist/i], "ELO");
  await clickByText(a, /queue it|^queue$|^add$|submit/i);

  await wait(a, 3500);
}
