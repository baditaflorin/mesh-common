// DeviceMotion gated; arm both + start session.
import { clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await clickByText(a, /join the room|^join$|connect/i);
  await clickByText(b, /join the room|^join$|connect/i);
  await wait(a, 800);
  await clickByText(a, /^start/i);
  await wait(a, 11000);
}
