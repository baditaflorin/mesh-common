// Both connect; A starts a round; B advances to next.
import { armBoth, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armBoth(a, b);
  await wait(a, 800);

  await clickByText(a, /start round|^start$|begin/i);
  await wait(a, 4000);

  await clickByText(b, /skip|next|advance/i);
  await wait(a, 3500);
  await clickByText(a, /skip|next|advance/i);

  await wait(a, 3500);
}
