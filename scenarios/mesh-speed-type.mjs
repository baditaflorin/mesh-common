export default async function speedTypeScenario(a, b) {
  await a.getByRole("button", { name: "Start 30-second race" }).click();
  await a.getByLabel("Type the race phrase").fill("small steady steps make surprisingly large changes");
  await b.waitForTimeout(2_500);
}
