export default async (a, b) => {
  await a.getByLabel("Your display name").fill("Avery");
  await b.getByLabel("Your display name").fill("Jordan");
  await a.getByLabel("Invitation purpose").fill("Workshop access");
  await a.getByLabel(/One-time code/i).fill("DESK-2026");
  await a.getByTestId("create-invitation").click();
  await b.getByText("Workshop access", { exact: true }).waitFor();
  await b.getByRole("button", { name: "Claim invitation" }).click();
  await a.getByText("Claimed by Jordan", { exact: true }).waitFor();
  await a.waitForTimeout(1200);
};
