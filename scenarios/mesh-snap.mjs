// Camera-gated synced countdown; both arm then A triggers a 3-2-1 snap.
import { clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await clickByText(a, /arm camera|^arm$|allow/i);
  await clickByText(b, /arm camera|^arm$|allow/i);
  await wait(a, 1500);

  await clickByText(a, /3-2-1 snap|snap|^go$/i);

  await wait(a, 9000);
}
