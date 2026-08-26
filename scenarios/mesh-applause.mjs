export default async function appreciationScenario(a, b) {
  await a.getByRole("button", { name: "Open the appreciation circle" }).click();
  await b.getByRole("button", { name: "Open the appreciation circle" }).click();

  await a.getByRole("button", { name: "Open settings" }).click();
  await a.getByPlaceholder("Add teammate").fill("Mika");
  await a.getByRole("button", { name: "Add", exact: true }).click();
  await a.getByRole("button", { name: /^close$/i }).click();
  await a.getByRole("heading", { name: "Hold a little good." }).waitFor();

  await b
    .locator("select option", { hasText: "Mika" })
    .waitFor({ state: "attached" });
  await a
    .getByPlaceholder("You made the hard part feel possible because…")
    .fill(
      "You made the hard part feel possible because you stayed calm when it mattered.",
    );
  await a.getByRole("button", { name: "Hold this note" }).click();
  await a.waitForTimeout(1000);
  await a.getByRole("button", { name: /Reveal the wall/ }).click();
  await b
    .getByText(
      "You made the hard part feel possible because you stayed calm when it mattered.",
    )
    .waitFor();
  await a.waitForTimeout(1200);
}
