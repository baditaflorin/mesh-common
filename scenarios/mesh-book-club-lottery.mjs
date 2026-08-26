export default async function bookClubScenario(a, b) {
  await a.getByPlaceholder("Reader name").fill("Ari");
  await b.getByPlaceholder("Reader name").fill("Bea");
  await a.getByLabel("Book title").fill("Kindred");
  await a.getByLabel("Author").fill("Octavia Butler");
  await a.getByRole("button", { name: "Add my nomination" }).click();
  await b.waitForTimeout(700);
  await b.getByLabel("Book title").fill("The Left Hand of Darkness");
  await b.getByLabel("Author").fill("Ursula K. Le Guin");
  await b.getByRole("button", { name: "Add my nomination" }).click();
  await a.waitForTimeout(700);
  await a.getByRole("button", { name: "Reveal the room’s pick" }).click();
  await b.waitForTimeout(1200);
}
