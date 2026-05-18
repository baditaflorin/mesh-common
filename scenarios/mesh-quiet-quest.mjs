// Mic-permission gated — arm both, click begin.
import { armConnect, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await armConnect(a);
  await armConnect(b);
  await clickByText(a, /^begin$|^start$/i);
  await wait(a, 11000);
}
