export default async function roleDrawScenario(a, b) {
  await a.getByRole("button", { name: "Claim role" }).first().click();
  await b
    .getByText(/Claimed by/, { exact: false })
    .waitFor({ timeout: 10_000 });
  await a.waitForTimeout(1_200);
}
