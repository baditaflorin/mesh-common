// Both peers join. A starts. Each claps for the other; rounds advance.
import { tryName, clickByText, wait, tapMany } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");
  await wait(a, 400);

  await clickByText(a, /start the contest|start|begin/i);
  await wait(a, 1200);

  // Each peer claps for the other ("clap for bob" etc.)
  await tapMany(a, 'button:has-text("clap for"), button:has-text("clap"), button:has-text("👏")', 4, 280);
  await tapMany(b, 'button:has-text("clap for"), button:has-text("clap"), button:has-text("👏")', 4, 280);

  await wait(a, 4000);
}
