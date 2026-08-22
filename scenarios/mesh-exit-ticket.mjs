export default async function exitTicketScenario(a, b) {
  await a.waitForTimeout(1_500);
  await a.getByLabel("Your takeaway").fill("The shared timing made the session easy to follow.");
  await a.getByRole("button", { name: "Share takeaway" }).click();
  await b.getByText("The shared timing made the session easy to follow.", { exact: true }).waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1_000);
}
