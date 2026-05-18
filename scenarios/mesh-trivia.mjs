// Both peers connect, pick a pack, then both answer the first question with
// different choices so the mesh shows a tiebreaker.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /connect|join|start/i);
  await clickByText(b, /connect|join|start/i);
  await wait(a, 800);

  // Pick the first available quiz pack (any button that looks like a pack)
  const packA = a.locator('button:has-text("knowledge"), button:has-text("trivia"), [class*=pack] button, [class*=deck] button').first();
  try { await packA.click({ timeout: 1200 }); } catch {
    // Fallback: click any visible button that isn't the connect one
    await clickByText(a, /general|knowledge|geo|sports|music|food/i);
  }
  await wait(a, 1200);

  // Both answer: alice picks first choice, bob picks second (mesh divergence)
  const choicesA = a.locator('.trivia-choice, [class*=choice] button, [aria-label*="answer"], button:visible').nth(2);
  const choicesB = b.locator('.trivia-choice, [class*=choice] button, [aria-label*="answer"], button:visible').nth(3);
  try { await choicesA.click({ timeout: 1500 }); } catch {}
  try { await choicesB.click({ timeout: 1500 }); } catch {}
  await wait(a, 2000);

  // Try to advance to "next question" / reveal
  await clickByText(a, /next|reveal|continue/i);
  await wait(a, 2000);

  // Pick again on the next question, opposite picks
  try { await b.locator('.trivia-choice, [class*=choice] button, button:visible').nth(2).click({ timeout: 1200 }); } catch {}
  try { await a.locator('.trivia-choice, [class*=choice] button, button:visible').nth(3).click({ timeout: 1200 }); } catch {}

  await wait(a, 2500);
}
