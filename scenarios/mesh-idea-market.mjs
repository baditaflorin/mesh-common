export default async function meshIdeaMarketScenario(a, b) {
  await a.getByPlaceholder("Name on your ideas").fill("Ari");
  await b.getByPlaceholder("Name on your ideas").fill("Bea");
  await a.getByPlaceholder("What should this group build, try, or decide?").fill("Host a neighborhood repair cafe");
  await a.getByRole("button", { name: "List it" }).click();
  await b.waitForTimeout(700);
  await b.getByRole("button", { name: "Add credit to Host a neighborhood repair cafe" }).click();
  await b.getByRole("button", { name: "Add credit to Host a neighborhood repair cafe" }).click();
  await a.waitForTimeout(1600);
}
