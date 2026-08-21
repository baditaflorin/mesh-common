export default async function crowdMapScenario(a, b) {
  await a.getByLabel("Your display name").fill("Ari");
  await b.getByLabel("Your display name").fill("Bea");
  await a.getByLabel("What did you notice?").fill("Short queue at registration");
  await a.getByLabel("Optional context").fill("About five minutes.");
  await a.getByLabel("Broad area").selectOption("north");
  await a.getByRole("button", { name: "Share for one hour" }).click();
  await b.getByText("Short queue at registration", { exact: true }).waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1_500);
}
