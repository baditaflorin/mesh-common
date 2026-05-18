// Both name themselves, A starts. Both write + seal a compliment. Reveal.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 400);

  await clickByText(a, /start round|start|begin/i);
  await wait(a, 1000);

  const ta = a.locator('textarea').first();
  const tb = b.locator('textarea').first();
  await ta.fill("you make pair-debugging feel like a fika break", { timeout: 800 }).catch(() => {});
  await tb.fill("your weekly notes are the calmest thing in my inbox", { timeout: 800 }).catch(() => {});
  await wait(a, 500);

  await clickByText(a, /^seal$|^lock$|submit/i);
  await clickByText(b, /^seal$|^lock$|submit/i);
  await wait(a, 1500);

  await clickByText(a, /reveal all|reveal/i);

  await wait(a, 3000);
}
