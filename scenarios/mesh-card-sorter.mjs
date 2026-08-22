export default async function cardSorterScenario(a, b) {
  await a.getByLabel(/New card/i).fill("First idea");
  await a.getByRole("button", { name: /Add card/i }).click();
  await b.getByText("First idea", { exact: true }).waitFor({ timeout: 10_000 });
  await a.waitForTimeout(1_200);
}
