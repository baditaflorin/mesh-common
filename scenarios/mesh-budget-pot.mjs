export default async function budgetPotScenario(a, b) {
  await a.getByLabel(/Amount/i).fill("12.50");
  await a.getByRole("button", { name: /Set contribution/i }).click();
  await b.getByText(/12.5/, { exact: false }).waitFor({ timeout: 10_000 });
  await a.waitForTimeout(1_200);
}
