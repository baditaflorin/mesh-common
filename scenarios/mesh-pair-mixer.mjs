export default async function pairMixerScenario(a, b) {
  await a.getByRole("button", { name: /Make pairs/i }).click();
  await b.getByText(/Pair/, { exact: false }).waitFor({ timeout: 10_000 });
  await a.waitForTimeout(1_200);
}
