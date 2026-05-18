// Alice claims drawer, scribbles on the canvas with simulated pointer events,
// bob types a guess. Then alice reveals so bob's guess is marked correct.
import { tryName, clickByText, wait } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  // Alice volunteers to draw
  await clickByText(a, /I'?ll draw|draw|start drawing|host/i);
  await wait(a, 800);

  // Read the secret word from alice's screen so bob can "guess" it correctly
  let secretWord = "";
  try {
    const wordEl = a.locator('.pic-word, [class*="word"]').first();
    if ((await wordEl.count()) > 0) {
      const t = (await wordEl.textContent({ timeout: 800 })) || "";
      secretWord = t.replace(/[^a-z]/gi, "").trim();
    }
  } catch {}
  if (!secretWord) secretWord = "elephant";

  // Pick a non-default color on alice (if pickers exist) for variety
  try { await a.locator('.pic-color, [class*="color"] button').nth(2).click({ timeout: 600 }); } catch {}

  // Scribble on the canvas with pointer events
  const canvas = a.locator('canvas').first();
  if ((await canvas.count()) > 0) {
    const box = await canvas.boundingBox().catch(() => null);
    if (box) {
      // Draw a quick squiggle
      const points = [
        [0.2, 0.3], [0.4, 0.4], [0.6, 0.3], [0.8, 0.5],
        [0.5, 0.6], [0.3, 0.7], [0.5, 0.8], [0.7, 0.7],
      ];
      const [x0, y0] = points[0];
      await a.mouse.move(box.x + box.width * x0, box.y + box.height * y0);
      await a.mouse.down();
      for (let i = 1; i < points.length; i++) {
        const [px, py] = points[i];
        await a.mouse.move(box.x + box.width * px, box.y + box.height * py, { steps: 6 });
        await a.waitForTimeout(120);
      }
      await a.mouse.up();
    }
  }
  await wait(a, 400);

  // Bob types a guess (the secret word, so it'll show ✅ on reveal)
  const guessIn = b.locator('input[placeholder*="guess" i], textarea[placeholder*="guess" i]').first();
  try { await guessIn.fill(secretWord, { timeout: 1000 }); } catch {}
  await clickByText(b, /^submit$|^guess$|send/i);
  await wait(a, 800);

  // Bob throws a second, wrong guess for visible activity
  try { await b.locator('input[placeholder*="guess" i]').first().fill("giraffe", { timeout: 600 }); } catch {}
  await clickByText(b, /^submit$|^guess$|send/i);
  await wait(a, 700);

  // Alice reveals
  await clickByText(a, /end.*reveal|reveal|finish/i);

  await wait(a, 2500);
}
