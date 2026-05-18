// A claims conductor and picks patterns; both phones flash in sync.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /take|claim|conductor/i);
  await wait(a, 800);

  for (const pat of [/slow/i, /fast/i, /strobe/i, /off/i]) {
    await clickByText(a, pat);
    await wait(a, 2200);
  }
}
