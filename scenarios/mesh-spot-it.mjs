export default async function spotItScenario(a, b) {
  await a.getByLabel("Your display name").fill("Ari");
  await b.getByLabel("Your display name").fill("Bea");
  await a.getByRole("button", { name: "Card A symbol ☀" }).click();
  await b.getByText(/Ari spotted the last match/i).waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1000);
}
