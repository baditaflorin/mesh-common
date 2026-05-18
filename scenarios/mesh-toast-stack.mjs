// Both join, A starts. Each writes a toast during their turn.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await clickByText(a, /^start$|begin/i);
  await wait(a, 1000);

  // Each types a toast; only the active turn's textarea is enabled
  const ta = a.locator('textarea').first();
  const tb = b.locator('textarea').first();
  await ta.fill("To the late-night bug-bashers who keep ships afloat 🥂", { timeout: 700 }).catch(() => {});
  await clickByText(a, /give toast|^give$|toast/i);
  await wait(a, 2500);

  // B's turn
  await tb.fill("To merge conflicts that ended in laughter 🥂", { timeout: 700 }).catch(() => {});
  await clickByText(b, /give toast|^give$|toast/i);
  await wait(a, 1500);

  // Both clink reactions
  await tapMany(a, 'button:has-text("🥂"), [aria-label*="clink" i]', 2, 300);
  await tapMany(b, 'button:has-text("🥂"), [aria-label*="clink" i]', 2, 300);

  await wait(a, 2500);
}
