export default async function roundCounterScenario(a, b) {
  await a.getByRole("button", { name: "Next round" }).click();
  await b.getByText("Round 1", { exact: true }).waitFor({ timeout: 10_000 });
  await a.waitForTimeout(1_200);
}
