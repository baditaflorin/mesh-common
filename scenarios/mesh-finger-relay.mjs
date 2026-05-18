// Turn-based drawing — both peers start; whichever has the active slot
// draws.  Drawing on both helps cover both turn halves.
import { tryName, clickByText, canvasScribble, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await clickByText(a, /start|begin|join/i);
  await wait(a, 800);

  // Try drawing on A's canvas during its turn
  await canvasScribble(a, {
    path: [[0.15, 0.5], [0.3, 0.4], [0.45, 0.6], [0.6, 0.45], [0.75, 0.55]],
  });
  await wait(a, 3500);

  // Now likely B's turn
  await canvasScribble(b, {
    path: [[0.2, 0.6], [0.4, 0.4], [0.55, 0.55], [0.7, 0.4], [0.85, 0.5]],
  });

  await wait(a, 4500);
}
