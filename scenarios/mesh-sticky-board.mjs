export default async function stickyBoardScenario(a, b) {
  await a.getByLabel("A new sticky note").fill("A bright shared idea");
  await a.getByRole("button", { name: "Add note" }).click();
  await b.getByText("A bright shared idea").waitFor({ timeout: 10_000 });
}
