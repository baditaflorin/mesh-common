// Peer A types a 6-digit code with a label, sends. B sees it land in the
// list with countdown + tap-to-copy.
import { fillFirst, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await fillFirst(a, [/123\s*456/, /code|digits/i], "847291");
  await fillFirst(a, [/label/i], "google");
  await wait(a, 400);
  await clickByText(a, /^send$|^add$|share/i);
  await wait(a, 1500);

  // B types its own (different) code
  await fillFirst(b, [/123\s*456/, /code|digits/i], "554103");
  await fillFirst(b, [/label/i], "github");
  await clickByText(b, /^send$|^add$|share/i);
  await wait(a, 1500);

  // B taps a copy button to surface "copied" feedback
  await tapMany(b, 'button:has-text("copy"), [aria-label*="copy" i]', 1, 200);
  await tapMany(a, 'button:has-text("copy"), [aria-label*="copy" i]', 1, 200);

  await wait(a, 2500);
}
