// Both join, tag each other a few times — lives tick down.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /^join$|spawn|begin/i);
  await clickByText(b, /^join$|spawn|begin/i);
  await wait(a, 800);

  // Each fires a "test tag" / "tag" button repeatedly
  await tapMany(a, 'button:has-text("test tag"), button:has-text("tag"), [aria-label*="tag" i]', 2, 600);
  await tapMany(b, 'button:has-text("test tag"), button:has-text("tag"), [aria-label*="tag" i]', 2, 600);
  await wait(a, 1500);
  await tapMany(a, 'button:has-text("test tag"), button:has-text("tag"), [aria-label*="tag" i]', 1, 500);

  await wait(a, 3500);
}
