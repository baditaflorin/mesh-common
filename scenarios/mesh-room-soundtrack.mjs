export default async function roomSoundtrackScenario(alice, bob) {
  await alice.getByLabel("Your name").fill("Mira");
  await bob.getByLabel("Your name").fill("Noah");

  await alice.getByLabel("Track title").fill("Morning Signal");
  await alice.getByLabel("Artist").fill("Mira & the Mesh");
  await alice.locator(".track-source-details summary").click();
  await alice
    .getByLabel("Source link")
    .fill("https://example.com/morning-signal");
  await alice
    .getByRole("button", { name: "Add to queue", exact: true })
    .click();

  await alice.waitForTimeout(450);
  await alice.getByLabel("Track title").fill("Golden Hour");
  await alice.getByLabel("Artist").fill("Mira & the Mesh");
  await alice
    .getByRole("button", { name: "Add to queue", exact: true })
    .click();

  await bob.waitForTimeout(650);
  await bob.getByRole("button", { name: "upvote Golden Hour" }).click();

  await bob.waitForTimeout(450);
  await bob.getByLabel("Track title").fill("Late Set");
  await bob.getByLabel("Artist").fill("Noah’s Quartet");
  await bob.getByRole("button", { name: "Add to queue", exact: true }).click();

  await alice.waitForTimeout(3200);
  await Promise.all([
    alice.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" })),
    bob.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" })),
  ]);
  await alice.waitForTimeout(250);
}
