export default async function particlesScenario(a, b) {
  await a.getByRole("button", { name: "Arm this phone" }).click();
  await b.getByRole("button", { name: "Arm this phone" }).click();
  await a.waitForTimeout(800);
  await a.getByRole("slider", { name: "Moment in" }).fill("1");
  await a.getByRole("button", { name: "Test light" }).click();
  await b.waitForTimeout(1_600);
}
