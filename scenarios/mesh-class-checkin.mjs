// Both fill name and check in — roster fills, capacity tracked.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await clickByText(a, /check in/i);
  await wait(a, 1200);

  await tryName(b, "bob");
  await clickByText(b, /check in/i);
  await wait(a, 4000);

  // Toggle leave / re-checkin on B
  await clickByText(b, /leave|undo/i);
  await wait(a, 700);
  await clickByText(b, /check in/i);

  await wait(a, 3000);
}
