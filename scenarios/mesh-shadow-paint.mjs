export default async function shadowPaintScenario(a, b) {
  await a.getByRole("button", { name: "Arm light panel" }).click();
  await b.getByRole("button", { name: "Arm light panel" }).click();
  await a.waitForTimeout(900);
  await a.getByRole("button", { name: "Rotate lighting palette" }).click();
  await b.waitForTimeout(1_200);
}
