// Both peers join with hourly rates, then alice starts the timer.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await fillFirst(a, [/hourly|rate|\$\/hr/i], "120");
  await clickByText(a, /add to total|^join$|^add$/i);
  await wait(a, 600);

  await tryName(b, "bob");
  await fillFirst(b, [/hourly|rate|\$\/hr/i], "180");
  await clickByText(b, /add to total|^join$|^add$/i);
  await wait(a, 600);

  await clickByText(a, /^start$|▶|begin/i);

  await wait(a, 10000);
}
