// QR-scan gated; show the board + cell selection on both peers.
import { tryName, clickNthButtons, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 600);

  // Tap a few cells to highlight selection state
  await clickNthButtons(a, [0, 4, 12, 20, 24]);
  await wait(a, 1500);
  await clickNthButtons(b, [6, 12, 18]);

  await wait(a, 4500);
}
