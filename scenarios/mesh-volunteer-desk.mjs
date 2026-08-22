export default async function volunteerDeskScenario(a, b) {
  await a.getByRole("button", { name: "Join desk" }).click();
  await a.getByLabel("New shift").fill("Set up welcome table");
  await a.getByRole("button", { name: "Add shift" }).click();
  await b.getByText(/Set up welcome table/).waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1_000);
}
