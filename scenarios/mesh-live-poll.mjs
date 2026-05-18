// A sets the question + options. Both peers vote on different options.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await fillFirst(a, [/ask a question|question/i], "Stack we should bet on for v2?");
  // Save question — Enter or save button
  await clickByText(a, /save|^ask$|^post$/i);
  await wait(a, 800);

  for (const opt of ["Rust + WASM", "Go + gRPC", "TypeScript everywhere"]) {
    await fillFirst(a, [/add an option|option/i], opt);
    await clickByText(a, /^\+ add$|^add$|^\+$/i);
    await a.waitForTimeout(300);
  }
  await wait(a, 600);

  // A votes one option; B votes another
  const aBtns = a.locator('button:has-text("Rust"), button:has-text("Go"), button:has-text("TypeScript")');
  const bBtns = b.locator('button:has-text("Rust"), button:has-text("Go"), button:has-text("TypeScript")');
  try { await aBtns.first().click({ timeout: 700 }); } catch {}
  try { await bBtns.nth(1).click({ timeout: 700 }); } catch {}

  await wait(a, 3500);
}
