export default async function agendaRunnerScenario(a, b) {
  await a.getByLabel("Agenda item").fill("Welcome and intentions");
  await a.getByRole("button", { name: "Add item" }).click();
  await b.getByText("Welcome and intentions", { exact: false }).waitFor({ timeout: 10_000 });
  await b
    .getByRole("button", { name: "Welcome and intentions · 10m", exact: true })
    .click();
  await a.waitForTimeout(1_200);
}
