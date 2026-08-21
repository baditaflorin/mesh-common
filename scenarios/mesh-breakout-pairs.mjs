export default async function breakoutPairsScenario(a, b) {
  await a.getByLabel("Your display name").fill("Nina");
  await b.getByLabel("Your display name").fill("Omar");
  await a.getByRole("button", { name: "Run this breakout" }).click();
  await a.getByRole("button", { name: "Start breakouts" }).click();
  await a.waitForTimeout(1600);
}
