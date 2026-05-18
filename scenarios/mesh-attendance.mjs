// Both peers fill name and check in — roster grows live.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await clickByText(a, /check in/i);
  await wait(a, 1500);

  await tryName(b, "bob");
  await clickByText(b, /check in/i);
  await wait(a, 2500);

  // Undo on A, then re-check
  await clickByText(a, /undo|cancel/i);
  await wait(a, 800);
  await clickByText(a, /check in/i);

  await wait(a, 3000);
}
