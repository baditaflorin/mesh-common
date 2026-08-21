export default async function pactScenario(a, b) {
  await a.getByLabel("Commitment").fill("Finish the release notes");
  await a.getByRole("button", { name: "Create shared pact" }).click();
  await b.waitForTimeout(1_500);
}
