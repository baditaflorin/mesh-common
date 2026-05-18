// A sets the prompt with two options; both vote; A reveals.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  const inputs = a.locator('input[type="text"]:not([placeholder*="name" i])');
  await inputs.nth(0).fill("Time-travel: only past, no future", { timeout: 700 }).catch(() => {});
  await inputs.nth(1).fill("Time-travel: only future, no past", { timeout: 700 }).catch(() => {});
  await clickByText(a, /set prompt|^set$|^post$/i);
  await wait(a, 1500);

  await clickByText(a, /^a$|rather a|option a/i);
  await clickByText(b, /^b$|rather b|option b/i);
  await wait(a, 1500);

  await clickByText(a, /reveal/i);

  await wait(a, 3500);
}
