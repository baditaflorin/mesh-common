// Camera-permission gated — arm both peers.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await clickByText(a, /arm front camera|arm|allow/i);
  await clickByText(b, /arm front camera|arm|allow/i);
  await wait(a, 11000);
}
