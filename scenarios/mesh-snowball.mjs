// A invites B (test-invite); the chain grows.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 600);

  // Fire a few test-invite taps on A
  await tapMany(a, 'button:has-text("test invite"), button:has-text("invite"), [aria-label*="invite" i]', 3, 600);

  await wait(a, 6500);
}
