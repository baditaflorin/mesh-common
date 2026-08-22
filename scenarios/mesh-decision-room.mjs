export default async function decisionRoomScenario(a, b) {
  await a.waitForTimeout(1_500);
  await a.getByLabel("Option").fill("Thursday lunch");
  await a.getByRole("button", { name: "Add" }).click();
  await a.getByText("Thursday lunch", { exact: true }).waitFor({ timeout: 10_000 });
  await a.getByRole("button", { name: "Rank" }).click();
  await a.getByText(/Leading choice: Thursday lunch/).waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1_000);
}
