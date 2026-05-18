// Camera-permission gated, so we just demonstrate the host flow + label.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  // A claims host (checkbox / toggle)
  await a.locator('input[type="checkbox"]').first().check({ timeout: 800 }).catch(() => {});
  await wait(a, 1200);

  // B opens scanner (no camera → button click still surfaces the affordance)
  await clickByText(b, /scan stamp|scan/i);
  await wait(a, 3000);

  // A renames the session if a label input exists
  await a.locator('input[type="text"]').last().fill("team standup", { timeout: 800 }).catch(() => {});
  await wait(a, 3500);
}
