// Geolocation-permission gated — show the share-my-location button + name.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await clickByText(a, /share my location|share/i);
  await clickByText(b, /share my location|share/i);
  await wait(a, 11000);
}
