// Both peers connect, pick a deck. In anonymous mode they each lock in an
// answer; the locks counter moves 0→1→2 and the reveal section appears.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /connect|join|start|begin/i);
  await clickByText(b, /connect|join|start|begin/i);
  await wait(a, 800);

  // Try to switch to anonymous mode for visible commit-reveal
  const setMode = async (page) => {
    const modeSel = page.locator('select').nth(1);
    if ((await modeSel.count()) > 0) {
      try { await modeSel.selectOption(/anonym/i); } catch {}
    }
  };
  await setMode(a);
  await setMode(b);
  await wait(a, 500);

  // Both type and lock in answers
  const answer = async (page, text) => {
    const ta = page.locator('textarea[placeholder*="answer" i], textarea').first();
    if ((await ta.count()) > 0) {
      try { await ta.fill(text, { timeout: 1000 }); } catch {}
    }
  };

  await answer(a, "Hot air ballooning over Cappadocia at sunrise — bucket list.");
  await answer(b, "Riding a sleeper train across Mongolia, no phone signal.");
  await wait(a, 400);

  await clickByText(a, /lock in|submit|send|done/i);
  await clickByText(b, /lock in|submit|send|done/i);
  await wait(a, 2500);

  // Advance to next prompt to show round 2 starting
  await clickByText(a, /next prompt|next|new prompt/i);

  await wait(a, 3000);
}
