// Both join, type 3 ideas each, advance to release/vote.
import { clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await clickByText(a, /join the brainstorm|join|start/i);
  await clickByText(b, /join the brainstorm|join|start/i);
  await wait(a, 800);

  const fillIdeas = async (page, ideas) => {
    const tas = page.locator('textarea, input[type="text"]:not([placeholder*="name" i])');
    const n = Math.min(await tas.count(), ideas.length);
    for (let i = 0; i < n; i++) {
      try { await tas.nth(i).fill(ideas[i], { timeout: 700 }); } catch {}
    }
  };

  await fillIdeas(a, [
    "ship a v0 in one weekend",
    "open-source the dataset",
    "weekly demo to the customer",
  ]);
  await fillIdeas(b, [
    "rip the legacy auth layer",
    "draft a north-star metric",
    "rotate on-call to share context",
  ]);
  await wait(a, 1200);

  // Advance to release / vote
  await clickByText(a, /done.*release|release|next phase/i);
  await wait(a, 1200);

  // Vote on a couple of cards if visible
  const voteA = a.locator('button:has-text("●"), [class*="card"] button, [class*="vote"] button').first();
  const voteB = b.locator('button:has-text("●"), [class*="card"] button, [class*="vote"] button').nth(1);
  try { await voteA.click({ timeout: 700 }); } catch {}
  try { await voteB.click({ timeout: 700 }); } catch {}

  await wait(a, 3000);
}
