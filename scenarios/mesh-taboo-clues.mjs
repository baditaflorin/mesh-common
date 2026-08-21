export default async function tabooScenario(a, b) {
  await a.getByRole("button", { name: "Start shared round" }).click();
  await b.getByRole("button", { name: /Flag a taboo word|Flagged/ }).click();
  await a.waitForTimeout(2_500);
}
