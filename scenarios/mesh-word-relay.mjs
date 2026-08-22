export default async function wordRelayScenario(a, b) {
  await a.getByLabel("Next word or phrase").fill("Once");
  await a.getByRole("button", { name: "Pass it on" }).click();
  await b.getByText("Once").waitFor({ timeout: 10_000 });
}
