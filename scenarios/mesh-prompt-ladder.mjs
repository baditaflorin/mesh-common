export default async function promptLadderScenario(a, b) {
  await a.getByLabel("Your display name").fill("Ari");
  await b.getByLabel("Your display name").fill("Bea");
  await a.getByRole("button", { name: "Start as facilitator" }).click();
  await b.getByText(/Warm up, rung 1/i).waitFor({ timeout: 10_000 });
  await b.getByRole("button", { name: "Request next rung" }).click();
  await a.getByRole("button", { name: "Confirm and advance" }).click();
  await b.getByText(/Grounded, rung 2/i).waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1_500);
}
