// A connects as camera, B as lamp; reshuffle palette.
import { clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await clickByText(a, /connect as camera|^camera$|arm/i);
  await clickByText(b, /connect as lamp|^lamp$|arm/i);
  await wait(a, 2000);

  await clickByText(b, /reshuffle palette|reshuffle|shuffle/i);
  await wait(a, 4000);
  await clickByText(a, /reshuffle palette|reshuffle|shuffle/i);

  await wait(a, 5000);
}
