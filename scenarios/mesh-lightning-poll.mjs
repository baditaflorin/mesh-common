export default async function lightningPollScenario(a, b) {
  await a.getByRole("button", { name: "Yes" }).click();
  await b.getByRole("button", { name: "Maybe" }).click();
  await b.getByText(/vote/, { exact: false }).waitFor({ timeout: 10_000 });
  await a.waitForTimeout(1_200);
}
