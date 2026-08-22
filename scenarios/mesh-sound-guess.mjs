export default async function soundGuessScenario(a, b) {
  await a.getByLabel("Your display name").fill("Ari");
  await b.getByLabel("Your display name").fill("Bea");
  await a.getByRole("button", { name: "Start a sound" }).click();
  await b.getByLabel("Your guess").fill("dog");
  await b.getByRole("button", { name: "Send guess" }).click();
  await a.getByText("Correct", { exact: true }).waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1_000);
}
