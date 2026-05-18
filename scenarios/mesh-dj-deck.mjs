// A takes the deck, drops a track. B reacts with 🔥 + ❤️.
import { tryName, fillFirst, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /take the deck|take|claim/i);
  await wait(a, 800);

  await fillFirst(a, [/title/i], "Pacific State");
  await fillFirst(a, [/artist/i], "808 State");
  await fillFirst(a, [/url|link/i], "https://example.org/track");
  await clickByText(a, /drop track|drop|^add$|submit/i);
  await wait(a, 1500);

  // B reacts twice with fire, once with heart
  await tapMany(b, 'button:has-text("🔥"), [aria-label*="fire" i]', 2, 300);
  await tapMany(b, 'button:has-text("❤️"), [aria-label*="heart|love" i]', 1, 300);

  // A drops a second track
  await fillFirst(a, [/title/i], "Born Slippy");
  await fillFirst(a, [/artist/i], "Underworld");
  await clickByText(a, /drop track|drop|^add$|submit/i);

  await wait(a, 2500);
}
