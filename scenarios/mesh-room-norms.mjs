export default async function roomNormsScenario(a, b) {
  await a.getByLabel("What would help this group?").fill("Step up, step back");
  await a.getByRole("button", { name: "Share norm" }).click();
  await b.getByText("Step up, step back", { exact: true }).waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1_500);
}
