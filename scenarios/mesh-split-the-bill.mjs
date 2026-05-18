// Both add items + price; both claim items so the per-person tally moves.
import { tryName, fillFirst, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  const addItem = async (page, name, price) => {
    await fillFirst(page, [/item name|name|item/i], name);
    await fillFirst(page, [/price|amount|\$/i], price);
    await clickByText(page, /^add$|^\+$|submit/i);
  };

  await addItem(a, "pasta carbonara", "16");
  await wait(a, 400);
  await addItem(a, "house wine", "8");
  await wait(a, 400);
  await addItem(b, "tiramisu", "6");
  await wait(a, 800);

  // Claim items: alternate
  await tapMany(a, '[aria-label*="claim" i], button:has-text("claim"), [class*="claim"]', 2, 350);
  await tapMany(b, '[aria-label*="claim" i], button:has-text("claim"), [class*="claim"]', 2, 350);

  await wait(a, 3500);
}
