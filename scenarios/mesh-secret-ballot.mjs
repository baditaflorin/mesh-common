// A writes question + opens ballot; both vote yes/no; A reveals.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await a.locator('textarea').first().fill("Adopt fully-remote Fridays?", { timeout: 800 }).catch(() => {});
  await wait(a, 400);

  await clickByText(a, /open ballot|open|start vote/i);
  await wait(a, 800);

  await clickByText(a, /vote yes|^yes$/i);
  await clickByText(b, /vote no|^no$/i);
  await wait(a, 1500);

  await clickByText(a, /reveal all|reveal/i);

  await wait(a, 4500);
}
