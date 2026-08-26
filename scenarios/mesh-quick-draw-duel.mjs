export default async function duelScenario(a, b) {
  await a.getByPlaceholder("Duelist name").fill("Ari");
  await b.getByPlaceholder("Duelist name").fill("Bea");
  await a.getByRole("button", { name: "Start 30-second round" }).click();
  await b.waitForTimeout(700);
  await a.getByRole("button", { name: "Add star mark" }).click();
  await b.getByRole("button", { name: "Add line mark" }).click();
  await a.getByRole("button", { name: "Finish my drawing" }).click();
  await b.waitForTimeout(800);
  await b.getByRole("button", { name: "Finish my drawing" }).click();
  await a.waitForTimeout(1200);
}
