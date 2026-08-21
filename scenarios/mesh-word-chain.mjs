export default async function meshWordChainScenario(a, b) {
  await a.getByPlaceholder("Choose a name").fill("Ari");
  await b.getByPlaceholder("Choose a name").fill("Bea");
  await a.getByRole("button", { name: "Start round" }).click();
  await a.waitForTimeout(900);

  const addIfReady = async (page, word) => {
    const input = page.getByLabel("Next word");
    if (await input.isEnabled()) {
      await input.fill(word);
      await page.getByRole("button", { name: "Add word" }).click();
      return true;
    }
    return false;
  };

  const first = (await addIfReady(a, "mesh")) || (await addIfReady(b, "mesh"));
  if (first) {
    await a.waitForTimeout(700);
    await addIfReady(a, "harbor");
    await addIfReady(b, "harbor");
  }
  await a.waitForTimeout(1700);
}
