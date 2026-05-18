// Both arm; each taps drums in rhythm.
import { armConnect, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await armConnect(a);
  await armConnect(b);
  await wait(a, 800);

  // Alternate drum hits across both peers
  for (let i = 0; i < 4; i++) {
    await tapMany(a, 'button:has-text("🥁"), [aria-label*="drum" i], [aria-label*="tap" i], main button:visible', 2, 250);
    await tapMany(b, 'button:has-text("🥁"), [aria-label*="drum" i], [aria-label*="tap" i], main button:visible', 2, 250);
  }

  await wait(a, 2500);
}
