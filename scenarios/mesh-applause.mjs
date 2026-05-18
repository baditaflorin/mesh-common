// Both peers join the appreciation wall, write a kudos for each other, then
// one of them clicks "reveal wall" so the cards appear in sync.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  await clickByText(a, /join wall|join|start/i);
  await clickByText(b, /join wall|join|start/i);
  await wait(a, 700);

  // Try to select a recipient from the roster <select>. If empty, write
  // anyway (some apps treat free text or implicit recipient).
  const pickRecipient = async (page, target) => {
    const sel = page.locator('select').first();
    if ((await sel.count()) > 0) {
      try { await sel.selectOption({ label: target }); } catch {
        // Fall back to selecting by index 1 (skip placeholder)
        try { await sel.selectOption({ index: 1 }); } catch {}
      }
    }
  };

  const writeKudos = async (page, text) => {
    const ta = page.locator('textarea').first();
    if ((await ta.count()) > 0) {
      try { await ta.fill(text, { timeout: 1000 }); } catch {}
    }
  };

  await pickRecipient(a, "bob");
  await writeKudos(a, "Saved the launch with one calm question. Thanks for the steady hand 🙏");
  await wait(a, 400);
  await clickByText(a, /^send$|submit|add|post/i);

  await pickRecipient(b, "alice");
  await writeKudos(b, "Your code review made me a better dev this quarter ✨");
  await wait(b, 400);
  await clickByText(b, /^send$|submit|add|post/i);
  await wait(a, 1500);

  await clickByText(a, /reveal wall|reveal|show all/i);

  await wait(a, 3500);
}
