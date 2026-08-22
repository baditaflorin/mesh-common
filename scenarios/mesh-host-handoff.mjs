export default async function hostHandoffScenario(a, b) {
  await a.getByRole("button", { name: /Claim host/i }).click();
  await b.getByText(/Host:/, { exact: false }).waitFor({ timeout: 10_000 });
  await a.waitForTimeout(1_200);
}
