export default async function duelScenario(a, b) {
  await a.getByPlaceholder("Duelist name").fill("Ari");
  await b.getByPlaceholder("Duelist name").fill("Bea");
  await a.getByRole("button", { name: "Start shared round" }).click();
  await b.waitForTimeout(700);
  await a.getByRole("button", { name: "Add star stamp" }).click();
  await b.getByRole("button", { name: "Add line stamp" }).click();
  await a.getByRole("button", { name: "Finish my drawing" }).click();
  await b.waitForTimeout(800);
  await b.getByRole("button", { name: "Finish my drawing" }).click();
  await a.waitForTimeout(1200);
}
