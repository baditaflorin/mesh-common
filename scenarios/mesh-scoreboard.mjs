async function closeSettings(page) {
  const dialog = page.getByRole("dialog", { name: "Settings" });
  if (!(await dialog.isVisible().catch(() => false))) return;
  const close = dialog.getByRole("button", { name: "close" });
  if (await close.isVisible().catch(() => false)) await close.click();
  else await page.keyboard.press("Escape");
}

export default async function scoreboardScenario(a, b) {
  await Promise.all([closeSettings(a), closeSettings(b)]);
  await a.getByLabel("Player name").fill("Ari");
  await b.getByLabel("Player name").fill("Bea");
  await a.waitForTimeout(500);
  await a.getByRole("button", { name: "Add 1 point" }).click();
  await b.getByRole("button", { name: "Add 2 points" }).click();
  await a.waitForTimeout(1400);
  await Promise.all([
    a.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" })),
    b.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" })),
  ]);
  await a.waitForTimeout(250);
}
