export default async function meshGiftExchangeScenario(a, b) {
  await a.getByLabel("Your name").fill("Ari");
  await b.getByLabel("Your name").fill("Bea");
  await a.getByLabel("Shared passphrase").fill("winter-lantern");
  await b.getByLabel("Shared passphrase").fill("winter-lantern");
  await a.waitForTimeout(1200);
  const wish = a.getByLabel("Something helpful for your giver");
  if (await wish.isEnabled()) {
    await wish.fill("A small green notebook would be lovely.");
    await a.getByRole("button", { name: "Seal my note" }).click();
  }
  await a.waitForTimeout(2500);
}
