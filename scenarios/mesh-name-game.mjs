// Both type names then submit answers for the round.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 500);

  // Most apps put the word/answer input as the second text input
  const answerA = a.locator('input[type="text"]:not([placeholder*="name" i])').first();
  const answerB = b.locator('input[type="text"]:not([placeholder*="name" i])').first();

  await answerA.fill("avocado", { timeout: 800 }).catch(() => {});
  await answerB.fill("aubergine", { timeout: 800 }).catch(() => {});
  await wait(a, 500);

  await clickByText(a, /^submit$|^send$|lock/i);
  await clickByText(b, /^submit$|^send$|lock/i);
  await wait(a, 2200);

  // Next round
  await answerA.fill("Helsinki", { timeout: 600 }).catch(() => {});
  await answerB.fill("Havana", { timeout: 600 }).catch(() => {});
  await clickByText(a, /^submit$|^send$|lock/i);
  await clickByText(b, /^submit$|^send$|lock/i);

  await wait(a, 3500);
}
