// A claims X, B claims O, they play a quick game.
import { clickByText, wait, clickNthButtons } from "./_helpers.mjs";

export default async function (a, b) {
  await clickByText(a, /^x$|claim x/i);
  await clickByText(b, /^o$|claim o/i);
  await wait(a, 600);

  // Standard X-wins-top-row path
  const moves = [
    { p: a, i: 0 }, // X top-left
    { p: b, i: 4 }, // O center
    { p: a, i: 1 }, // X top-middle
    { p: b, i: 5 }, // O middle-right
    { p: a, i: 2 }, // X top-right — wins
  ];

  for (const { p, i } of moves) {
    await clickNthButtons(p, [i], 'button:has-text(""), button[class*="cell"], [role="grid"] button:visible');
    await p.waitForTimeout(700);
  }

  // Rematch
  await clickByText(a, /rematch|new game|^reset$/i);

  await wait(a, 3500);
}
