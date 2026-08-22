export default async function scoreboardScenario(a, b) {
  await a.getByRole("button", { name: "Add my point" }).click();
  await b.getByRole("button", { name: "Add my point" }).click();
  await b.getByRole("button", { name: "Add my point" }).click();
  await a.getByLabel("Scores").waitFor({ timeout: 10_000 });
  await a.waitForTimeout(1_200);
}
