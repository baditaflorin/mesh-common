// Both join the tournament. A builds the bracket. QR-mediated win-report is
// hard to exercise headless, so we surface the bracket UI.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await clickByText(a, /join tournament|join|enter/i);
  await wait(a, 800);

  await tryName(b, "bob");
  await clickByText(b, /join tournament|join|enter/i);
  await wait(a, 1200);

  await clickByText(a, /build bracket|build|seed|start tournament/i);
  await wait(a, 4000);

  // Try a "report win" button if it exists on either side
  await clickByText(a, /i beat|won|report/i);

  await wait(a, 3500);
}
