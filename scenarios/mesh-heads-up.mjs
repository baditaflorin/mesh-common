export default async function headsUpScenario(a, b) {
  await a.getByRole("button", { name: "Start clue relay" }).click();
  await b.getByText(/Turn 1/i).waitFor({ timeout: 10_000 });
  const aPass = a.getByRole("button", { name: "Got it — pass on" });
  const bPass = b.getByRole("button", { name: "Got it — pass on" });
  if (await aPass.isEnabled()) await aPass.click();
  else await bPass.click();
  await b.getByText(/Turn 2/i).waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1_500);
}
