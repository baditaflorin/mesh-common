// A drops a topic; both rate. The histogram diverges.
import { tryName, clickByText, setRange, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await clickByText(a, /^start$|^begin$/i);
  await wait(a, 800);

  const ta = a.locator('textarea').first();
  await ta.fill("Pineapple on pizza", { timeout: 800 }).catch(() => {});
  await clickByText(a, /drop topic|^drop$|submit/i);
  await wait(a, 1200);

  // Both slide their rating: A loves it, B hates it
  await setRange(a, 0.85);
  await setRange(b, 0.1);
  await wait(a, 2500);

  // Next topic
  await ta.fill("Standing desks", { timeout: 600 }).catch(() => {});
  await clickByText(a, /drop topic|^drop$|submit/i);
  await wait(a, 1000);
  await setRange(a, 0.6);
  await setRange(b, 0.7);

  await wait(a, 3000);
}
