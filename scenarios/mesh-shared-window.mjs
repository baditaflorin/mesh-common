// Camera-permission gated — set labels and arm both.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice's window");
  await tryName(b, "bob's window");
  await clickByText(a, /open camera|camera|join/i);
  await clickByText(b, /open camera|camera|join/i);
  await wait(a, 11500);
}
