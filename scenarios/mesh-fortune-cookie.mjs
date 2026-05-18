// Both add fortunes, then crack a cookie.
import { tryName, fillFirst, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  for (const f of [
    "You'll ship before lunch.",
    "Today's bug is yesterday's mis-cached read.",
  ]) {
    await fillFirst(a, [/fortune|write|input/i], f);
    await clickByText(a, /^add$|submit|^post$/i);
    await a.waitForTimeout(350);
  }
  for (const f of [
    "Trust the diff, not the prose.",
    "Refactor wins compound; prefer them.",
  ]) {
    await fillFirst(b, [/fortune|write|input/i], f);
    await clickByText(b, /^add$|submit|^post$/i);
    await b.waitForTimeout(350);
  }
  await wait(a, 800);

  await clickByText(a, /crack a cookie|^draw$|crack/i);
  await wait(a, 2200);
  await clickByText(b, /crack a cookie|^draw$|crack/i);

  await wait(a, 3000);
}
