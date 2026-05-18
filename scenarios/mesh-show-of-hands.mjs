// Both peers raise; A lowers + raises again.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await clickByText(a, /raise hand|✋/i);
  await wait(a, 1500);

  await tryName(b, "bob");
  await clickByText(b, /raise hand|✋/i);
  await wait(a, 2500);

  await clickByText(a, /lower hand|^lower$|drop/i);
  await wait(a, 1500);
  await clickByText(a, /raise hand|✋/i);

  await wait(a, 3500);
}
