export default async function passThePhoneScenario(a, b) {
  await a.getByLabel("Your display name").fill("Ari");
  await b.getByLabel("Your display name").fill("Bea");
  await a.getByRole("button", { name: "Start round" }).click();
  await b.getByText(/Turn 1:/).waitFor({ timeout: 10_000 });

  const completeA = a.getByRole("button", { name: "I completed this prompt" });
  const completeB = b.getByRole("button", { name: "I completed this prompt" });
  if (await completeA.isEnabled()) await completeA.click();
  else await completeB.click();

  await b.getByText(/Turn 2:/).waitFor({ timeout: 10_000 });
  await b.waitForTimeout(1_500);
}
