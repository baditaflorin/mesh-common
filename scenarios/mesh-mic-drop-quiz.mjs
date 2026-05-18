// Both peers fill a quiz with answer + correct radio; A starts hosting; B answers.
import { tryName, clickByText, wait, clickNthButtons } from "./_helpers.mjs";

export default async function (a, b) {
  await tryName(a, "alice");
  await tryName(b, "bob");

  const fillQuiz = async (page, question, answers, correctIdx) => {
    const ta = page.locator('textarea').first();
    await ta.fill(question, { timeout: 800 }).catch(() => {});
    const inputs = page.locator('input[type="text"]:not([placeholder*="name" i])');
    const n = Math.min(await inputs.count(), answers.length);
    for (let i = 0; i < n; i++) {
      await inputs.nth(i).fill(answers[i], { timeout: 600 }).catch(() => {});
    }
    const radios = page.locator('input[type="radio"]');
    if ((await radios.count()) > correctIdx) {
      await radios.nth(correctIdx).check({ timeout: 600 }).catch(() => {});
    }
  };

  await fillQuiz(a, "What's the bus factor for a one-author repo?", ["1", "2", "infinity", "0"], 0);
  await fillQuiz(b, "Cache invalidation is hard because…?", ["bugs", "race conditions", "all of the above", "I don't know"], 2);
  await wait(a, 500);

  await clickByText(a, /submit my quiz|submit/i);
  await clickByText(b, /submit my quiz|submit/i);
  await wait(a, 1200);

  await clickByText(a, /start hosting|host|begin/i);
  await wait(a, 1500);

  // B clicks an answer choice
  await clickNthButtons(b, [0]);
  await wait(a, 2500);
}
