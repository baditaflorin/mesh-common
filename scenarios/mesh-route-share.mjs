// Geolocation gated — set names, toggle share, dwell on map.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await clickByText(a, /share my route|share/i);
  await clickByText(b, /share my route|share/i);
  await wait(a, 12000);
}
