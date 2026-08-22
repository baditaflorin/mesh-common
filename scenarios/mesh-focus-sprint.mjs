export default async function focusSprintScenario(a, b) {
  await a.getByRole("button", { name: "Start 25 minutes" }).click();
  await b.getByText("running", { exact: true }).waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1_000);
}
