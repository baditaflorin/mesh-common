export default async function fiveSecondRuleScenario(a, b) {
  await a.getByPlaceholder("Add a name for this room").fill("Ari");
  await b.getByPlaceholder("Add a name for this room").fill("Bea");
  await a.waitForTimeout(900);

  const aAnswer = a.getByRole("button", { name: "I said all three!" });
  if (await aAnswer.isVisible().catch(() => false)) {
    await aAnswer.click();
  } else {
    const bAnswer = b.getByRole("button", { name: "I said all three!" });
    if (await bAnswer.isVisible().catch(() => false)) await bAnswer.click();
  }
  await a.waitForTimeout(2_500);
}
