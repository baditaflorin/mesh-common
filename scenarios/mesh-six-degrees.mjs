// QR-mediated path; name + set start/goal markers.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 400);

  await clickByText(a, /set me as start|^🅰/i);
  await clickByText(b, /set me as goal|^🅱/i);

  await wait(a, 11000);
}
