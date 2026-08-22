export default async function promptDeckScenario(a, b) {
  await a.getByLabel("New prompt").fill("What made you smile this week?");
  await a.getByRole("button", { name: "Add prompt" }).click();
  await b.getByText("What made you smile this week?", { exact: true }).waitFor({ timeout: 10_000 });
  await b
    .getByRole("button", { name: "What made you smile this week?", exact: true })
    .click();
  await a.waitForTimeout(1_200);
}
