// Both peers join, get paired (deterministic shuffle), submit a word in the
// given category. We pick the same word on both sides to trigger "MELD!".
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /start|join|connect/i);
  await clickByText(b, /start|join|connect/i);
  await wait(a, 1200);

  // Find the word input on each side (skip the name input we already filled)
  const wordA = a.locator('input[placeholder*="word" i], input:not([placeholder*="name" i])').first();
  const wordB = b.locator('input[placeholder*="word" i], input:not([placeholder*="name" i])').first();

  // Pick a word likely-shared across categories
  try { await wordA.fill("apple", { timeout: 1000 }); } catch {}
  try { await wordB.fill("apple", { timeout: 1000 }); } catch {}
  await wait(a, 400);

  await clickByText(a, /submit word|submit|lock/i);
  await clickByText(b, /submit word|submit|lock/i);
  await wait(a, 2500);

  // Next round — try a fruit-ish word again (works if category morphs to fruit)
  try { await a.locator('input[placeholder*="word" i]').first().fill("orange", { timeout: 800 }); } catch {}
  try { await b.locator('input[placeholder*="word" i]').first().fill("banana", { timeout: 800 }); } catch {}
  await clickByText(a, /submit/i);
  await clickByText(b, /submit/i);

  await wait(a, 3000);
}
