// A writes the petition; both sign with optional comment.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  // A clicks the editable petition display & writes
  await clickByText(a, /^petition$|^untitled$|tap to edit/i);
  await fillFirst(a, [/petition title|title/i], "Bring back free coffee Fridays");
  await a.locator('textarea').first().fill("Morale loved it; the budget is rounding error. Restore the perk.", { timeout: 800 }).catch(() => {});
  await clickByText(a, /^save$/i);
  await wait(a, 1500);

  // A signs (optional comment)
  await fillFirst(a, [/why you'?re signing|comment/i], "we miss it more than we realised");
  await clickByText(a, /sign petition|^sign$/i);
  await wait(a, 1500);

  // B signs
  await fillFirst(b, [/why you'?re signing|comment/i], "+1, the espresso machine was a community pillar");
  await clickByText(b, /sign petition|^sign$/i);

  await wait(a, 3500);
}
