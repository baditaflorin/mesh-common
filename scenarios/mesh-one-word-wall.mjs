export default async function oneWordWallScenario(a, b) {
  await a.getByLabel("Your word").fill("Curious");
  await a.getByRole("button", { name: "Share word" }).click();
  await b.getByText("Curious", { exact: true }).waitFor({ timeout: 10_000 });
  await b.getByLabel("Your word").fill("Hopeful");
  await b.getByRole("button", { name: "Share word" }).click();
  await a.waitForTimeout(1_200);
}
