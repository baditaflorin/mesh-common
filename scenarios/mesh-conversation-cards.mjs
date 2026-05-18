// Load the default deck and start playing — cards advance through peers.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /load default pool|load default|load/i);
  await wait(a, 600);
  await clickByText(a, /^start$|begin/i);
  await wait(a, 1500);

  // Advance through 3 cards
  for (let i = 0; i < 3; i++) {
    await clickByText(a, /next card|next/i);
    await wait(a, 1500);
  }

  await wait(a, 3000);
}
