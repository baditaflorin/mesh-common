// Alice drops a question. Bob (spotlight) picks it, then both peers tap
// reactions so the live counters move on both screens.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  // Bob grabs the spotlight if it's available
  await clickByText(b, /claim spotlight|spotlight|take stage/i);
  await wait(a, 600);

  // Alice asks a juicy question
  const askA = a.locator('textarea[placeholder*="anonym" i], textarea').first();
  try { await askA.fill("What's the kindest thing a stranger ever did for you?", { timeout: 1000 }); } catch {}
  await clickByText(a, /drop q|drop|send|ask/i);
  await wait(a, 1200);

  // Bob picks alice's question from the pending list
  await clickByText(b, /^pick$|select|use this/i);
  await wait(a, 1200);

  // Both fire reactions (🔥 💯 😬)
  const fireA = a.locator('.tb-fire, button:has-text("🔥"), [aria-label*="fire" i]').first();
  const hundoB = b.locator('.tb-hundo, button:has-text("💯"), [aria-label*="100" i]').first();
  const grimaceA = a.locator('.tb-grimace, button:has-text("😬"), [aria-label*="oof" i]').first();

  try { await fireA.click({ timeout: 800 }); } catch {}
  await wait(a, 300);
  try { await hundoB.click({ timeout: 800 }); } catch {}
  await wait(a, 300);
  try { await fireA.click({ timeout: 800 }); } catch {}
  await wait(a, 300);
  try { await grimaceA.click({ timeout: 800 }); } catch {}

  await wait(a, 3000);
}
