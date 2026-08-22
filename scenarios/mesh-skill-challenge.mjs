export default async function skillChallengeScenario(a, b) {
  await a.getByLabel("Your display name").fill("Ari");
  await b.getByLabel("Your display name").fill("Bea");
  await a.getByLabel("Challenge title").fill("Describe a favorite place in three sentences");
  await a.getByLabel("Skill focus").selectOption("Speaking");
  await a.getByLabel("Optional encouragement").fill("Aim for a vivid detail.");
  await a.getByRole("button", { name: "Share challenge" }).click();
  await b
    .getByRole("heading", { name: "Describe a favorite place in three sentences" })
    .waitFor({ timeout: 10_000 });
  await b.getByRole("button", { name: "I tried it" }).click();
  await a.getByText("1 completed").waitFor({ timeout: 10_000 });
  await a.waitForTimeout(1_000);
}
