// A opens a market; both bet yes/no; A resolves.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await fillFirst(a, [/^question$|question|market/i], "Will the demo gif render before Friday?");
  await clickByText(a, /open market|^open$|create/i);
  await wait(a, 1200);

  // A bets YES
  const aAmt = a.locator('input[type="number"]').first();
  await aAmt.fill("50", { timeout: 700 }).catch(() => {});
  await clickByText(a, /bet yes|^yes$/i);
  await wait(a, 1000);

  // B bets NO
  const bAmt = b.locator('input[type="number"]').first();
  await bAmt.fill("75", { timeout: 700 }).catch(() => {});
  await clickByText(b, /bet no|^no$/i);
  await wait(a, 1500);

  await clickByText(a, /resolve yes|^yes$/i);

  await wait(a, 3500);
}
