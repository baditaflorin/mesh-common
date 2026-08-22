export default async function notePileScenario(a, b) {
  await a.getByLabel("New note").fill("Keep the next step small");
  await a.getByRole("button", { name: "Add note" }).click();
  await b
    .getByText("Keep the next step small", { exact: true })
    .waitFor({ timeout: 10_000 });
  await a.waitForTimeout(1_200);
}
