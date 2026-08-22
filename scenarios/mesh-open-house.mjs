export default async function openHouseScenario(a, b) {
  await a.getByRole("button", { name: /yes/i }).click();
  await b.getByRole("button", { name: /maybe/i }).click();
  await b.getByText(/yes/, { exact: false }).last().waitFor({ timeout: 10_000 });
  await a.waitForTimeout(1_200);
}
