// A is host (arms listening). B is at the door, rings repeatedly.
import { tryName, fillFirst, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  // A: host
  await clickByText(a, /i'?m home|home|host/i);
  await clickByText(a, /arm|enable/i);
  await wait(a, 600);

  // B: guest
  await clickByText(b, /i'?m at the door|at the door|guest/i);
  await tryName(b, "bob");
  await fillFirst(b, [/who'?s at the door|name|visitor/i], "bob");
  await wait(b, 400);

  // Ring 3 times
  await tapMany(b, 'button:has-text("RING"), button:has-text("🔔"), [aria-label*="ring" i]', 3, 700);

  await wait(a, 3500);
}
