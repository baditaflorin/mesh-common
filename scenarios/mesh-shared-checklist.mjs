export default async function sharedChecklistScenario(a, b) {
  await a.getByLabel("What needs doing?").fill("Bring the picnic blanket");
  await a.getByLabel("Owner (optional)").fill("Alex");
  await a.getByRole("button", { name: "Add to checklist" }).click();
  await b.getByText("Bring the picnic blanket", { exact: true }).waitFor({ timeout: 10_000 });
  await b.getByRole("checkbox").check();
  await a.getByText("1 of 1 tasks complete", { exact: false }).waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1_500);
}
