// Both join + commit; A starts game; both reveal.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /join.*commit|^join$|commit a salt/i);
  await clickByText(b, /join.*commit|^join$|commit a salt/i);
  await wait(a, 1500);

  await clickByText(a, /start game|begin|^start$/i);
  await wait(a, 1500);

  await clickByText(a, /reveal my salt|reveal/i);
  await clickByText(b, /reveal my salt|reveal/i);

  await wait(a, 4500);
}
