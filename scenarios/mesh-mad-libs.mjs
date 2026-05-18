// Both fill the slots in the default template, then submit + reveal.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  const fillSlots = async (page, words) => {
    const inputs = page.locator('input[type="text"]:not([placeholder*="name" i])');
    const n = Math.min(await inputs.count(), words.length);
    for (let i = 0; i < n; i++) {
      try { await inputs.nth(i).fill(words[i], { timeout: 600 }); } catch {}
    }
  };

  await fillSlots(a, ["alpaca", "purple", "Stockholm", "ferociously", "tiramisu"]);
  await fillSlots(b, ["bagpipe", "luminous", "Mars", "tenderly", "umami"]);
  await wait(a, 600);

  await clickByText(a, /submit blindly|^submit$|seal/i);
  await clickByText(b, /submit blindly|^submit$|seal/i);
  await wait(a, 1500);

  await clickByText(a, /reveal/i);
  await wait(a, 3500);
}
