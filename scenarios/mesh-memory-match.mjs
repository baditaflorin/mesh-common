export default async function memoryMatchScenario(a, b) {
  await a.getByLabel("Your display name").fill("Ari");
  await b.getByLabel("Your display name").fill("Bea");
  await a.getByRole("button", { name: "Card 1, face down" }).click();
  await b.getByRole("button", { name: "Card 10, face down" }).click();
  await a.getByText("1 of 6 pairs found").waitFor({ timeout: 10_000 });
  await Promise.all([
    a.evaluate(() => window.scrollTo(0, 0)),
    b.evaluate(() => window.scrollTo(0, 0)),
  ]);
  await a.waitForTimeout(1_700);
}
