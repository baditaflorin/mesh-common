export default async function particlesScenario(a, b) {
  await a.getByRole("button", { name: "Arm this phone" }).click();
  await b.getByRole("button", { name: "Arm this phone" }).click();
  await a.waitForTimeout(800);
  await a.getByRole("button", { name: /Test cue/ }).click();
  await b.waitForTimeout(3_600);
}
