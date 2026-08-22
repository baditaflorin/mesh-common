export default async function pixelPartyScenario(a, b) {
  await a.getByRole("button", { name: /Cell 1, 1/ }).click();
  await b.getByRole("button", { name: /Cell 1, 1, #f97316/ }).waitFor({ timeout: 10_000 });
}
