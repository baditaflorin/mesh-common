// Both peers arm their cards and tap squares to claim them — the grid lights
// up with claims and the "spotted" count rises.
import { tryName, clickByText, wait, clickNthButtons } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /get my card|start|join/i);
  await clickByText(b, /get my card|start|join/i);
  await wait(a, 1200);

  // Tap a line of cells: top row + center + diagonal
  await clickNthButtons(a, [0, 1, 2, 3, 12, 18, 24]);
  await wait(a, 600);
  await clickNthButtons(b, [5, 9, 12, 15, 19]);

  await wait(a, 3500);
}
