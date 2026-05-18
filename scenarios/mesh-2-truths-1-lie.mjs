// Both peers submit 3 statements, mark one as the lie, commit. Then both
// reveal so the vote phase opens with each other's statements visible.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  const fillThree = async (page, statements, lieIdx) => {
    const inputs = page.locator('input[type="text"]:not([placeholder*="name" i])');
    const count = Math.min(await inputs.count(), statements.length);
    for (let i = 0; i < count; i++) {
      try { await inputs.nth(i).fill(statements[i], { timeout: 1000 }); } catch {}
    }
    // Mark the lie via radio buttons
    const radios = page.locator('input[type="radio"]');
    if ((await radios.count()) > lieIdx) {
      try { await radios.nth(lieIdx).check({ timeout: 1000 }); } catch {}
    }
  };

  await fillThree(a, ["I've climbed Everest", "I speak 5 languages", "I have a pet snake"], 1);
  await fillThree(b, ["I once met the queen", "I can juggle 4 balls", "I hate chocolate"], 2);
  await wait(a, 600);

  await clickByText(a, /commit|submit|lock/i);
  await clickByText(b, /commit|submit|lock/i);
  await wait(a, 1500);

  // Once both committed, a "reveal" button appears
  await clickByText(a, /reveal/i);
  await clickByText(b, /reveal/i);
  await wait(a, 1500);

  // Try to cast a vote on one of the visible statements
  const voteBtnsA = a.locator(".ttl-card button, [class*=statement] button").first();
  const voteBtnsB = b.locator(".ttl-card button, [class*=statement] button").last();
  try { await voteBtnsA.click({ timeout: 1000 }); } catch {}
  try { await voteBtnsB.click({ timeout: 1000 }); } catch {}

  await wait(a, 2500);
}
