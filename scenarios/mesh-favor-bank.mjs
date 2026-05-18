// Both pick a direction + add a note; QR scan is camera-bound, so we show
// the form-state and the ledger area instead.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /i did them a favor|did them|i owe them/i);
  await fillFirst(a, [/optional note|note/i], "covered the coffee run");
  await wait(a, 1500);

  await clickByText(b, /they did me a favor|did me|they owe me/i);
  await fillFirst(b, [/optional note|note/i], "lent me her charger");
  await wait(a, 1500);

  // Switch A to the other direction and add another note
  await clickByText(a, /they did me a favor|did me/i);
  await fillFirst(a, [/optional note|note/i], "watered my plants");

  await wait(a, 4500);
}
