export default async function agendaRunnerScenario(a, b) {
  await a
    .getByPlaceholder("e.g. Align on launch decisions")
    .fill("Align on release decisions");
  await a.getByRole("button", { name: "15m" }).click();
  await a.getByRole("button", { name: "Add to agenda" }).click();

  await a
    .getByPlaceholder("e.g. Align on launch decisions")
    .fill("Close with clear owners");
  await a.getByRole("button", { name: "10m" }).click();
  await a.getByRole("button", { name: "Add to agenda" }).click();

  await b
    .getByRole("button", {
      name: "Make Align on release decisions the current item",
    })
    .waitFor();
  await b
    .getByRole("button", {
      name: "Make Align on release decisions the current item",
    })
    .click();
  await a.waitForTimeout(1100);
  await a.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
  await b.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
  await a.waitForTimeout(250);
}
