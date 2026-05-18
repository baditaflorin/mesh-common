// Audience submits a question, peer upvotes it; presenter marks answered.
import { fillFirst, clickByText, wait, tryName } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /join room|join|enter/i);
  await clickByText(b, /join room|join|enter/i);
  await wait(a, 600);

  await fillFirst(a, [/ask anything|ask|question/i], "Why is the sky blue?");
  await clickByText(a, /^submit$|^ask$|^post$/i);
  await wait(a, 800);

  await fillFirst(b, [/ask anything|ask|question/i], "What's the bus factor?");
  await clickByText(b, /^submit$|^ask$|^post$/i);
  await wait(a, 1000);

  // B upvotes A's question and vice versa
  await b.locator('button:has-text("Upvote"), button:has-text("👍"), [aria-label*="upvote" i]').first().click({ timeout: 800 }).catch(() => {});
  await wait(a, 400);
  await a.locator('button:has-text("Upvote"), button:has-text("👍"), [aria-label*="upvote" i]').first().click({ timeout: 800 }).catch(() => {});
  await wait(a, 800);

  // Mark answered (presenter affordance)
  await clickByText(a, /mark answered|answered/i);

  await wait(a, 2500);
}
