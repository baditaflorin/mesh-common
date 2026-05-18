// Both name themselves; A deals. Roles surface after commit-reveal.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 500);

  await clickByText(a, /^deal$|deal roles|begin/i);

  await wait(a, 11500);
}
