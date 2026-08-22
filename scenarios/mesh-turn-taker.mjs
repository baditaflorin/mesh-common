export default async function turnTakerScenario(a, b) {
  await a.getByRole("button", { name: /Start order/i }).click();
  await a.getByRole("button", { name: /Next turn/i }).click();
  await b.getByText(/Current/, { exact: false }).waitFor({ timeout: 10_000 });
  await a.waitForTimeout(1_200);
}
