// Both submit a post + react.
import { tryName, fillFirst, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /^submit$|^post$|compose/i);
  await fillFirst(a, [/your post|post|message/i], "Hello from the kiosk wall ✨");
  await clickByText(a, /post it|^post$|publish/i);
  await wait(a, 1000);

  await clickByText(b, /^submit$|^post$|compose/i);
  await fillFirst(b, [/your post|post|message/i], "Greetings from the other phone 👋");
  await clickByText(b, /post it|^post$|publish/i);
  await wait(a, 1500);

  // Reactions
  await tapMany(a, 'button:has-text("❤️"), button:has-text("👍"), button:has-text("🔥")', 2, 250);
  await tapMany(b, 'button:has-text("🎉"), button:has-text("😂")', 2, 250);

  await wait(a, 3000);
}
