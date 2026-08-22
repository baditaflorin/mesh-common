export default async function bingoBlitzScenario(a, b) {
  await a.getByRole("button", { name: /Says hello/ }).waitFor({ timeout: 10_000 });
  await a.getByRole("button", { name: /Says hello/ }).click();
  await b.getByRole("button", { name: /Says hello.*1 claim/ }).waitFor({ timeout: 10_000 });
}
