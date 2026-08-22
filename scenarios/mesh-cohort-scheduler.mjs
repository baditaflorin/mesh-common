export default async function cohortSchedulerScenario(a, b) {
  await a.getByLabel("Tue 18:00").check();
  await b.getByLabel("Tue 18:00").check();
  await b.getByText(/Tue 18:00 is currently the strongest match/).waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1_000);
}
