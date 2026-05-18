// Both connect, A starts a round, both watch the shared timer.
import { armBoth, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armBoth(a, b);
  await wait(a, 600);

  await clickByText(a, /start round|^start$|begin/i);
  await wait(a, 4000);

  // B taps "done early"
  await clickByText(b, /done early|^done$|^✓/i);
  await wait(a, 3500);

  // A taps "stuck"
  await clickByText(a, /^stuck$|stuck/i);

  await wait(a, 3500);
}
